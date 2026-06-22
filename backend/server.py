from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, shutil
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_IMG = {'.jpg', '.jpeg', '.png', '.webp', '.heic'}
ALLOWED_DOC = {'.pdf'}

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# WIB timezone helper (UTC+7) for daily checkpoint
WIB = timezone(timedelta(hours=7))
def today_wib() -> str:
    return datetime.now(WIB).strftime("%Y-%m-%d")


# ---------- Models ----------
class TripInit(BaseModel):
    trip_id: str
    driver_id: Optional[str] = None
    nopol: str
    route: str = ""
    uj: int = 0
    t1: int = 0
    t2: int = 0
    t3: int = 0
    bonus_daily: int = 30000
    bonus_kerajinan: int = 150000

class DriverName(BaseModel):
    nama: str

class CairBody(BaseModel):
    tahap: int   # 1, 2, or 3

class WAAction(BaseModel):
    nama: Optional[str] = None


def trip_doc_to_public(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ---------- Endpoints ----------
@api_router.get("/")
async def root():
    return {"message": "Alyssa Driver Checkpoint API", "v": "2.0"}


@api_router.post("/trips/init")
async def init_trip(payload: TripInit):
    """Idempotent — buat trip kalau belum ada, kalau sudah ada return existing."""
    existing = await db.trips.find_one({"trip_id": payload.trip_id})
    if existing:
        return trip_doc_to_public(existing)
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "nama_driver": "",
        "sop_read": False,
        "initial_photos": {},   # { 'depan': {url, ts}, 'belakang': ..., 'kiri': ..., 'kanan': ..., 'spidometer': ..., 'bbm': ... }
        "daily_checkpoints": [],  # [{date: 'YYYY-MM-DD', url, ts}]
        "handover": {"bastk": [], "resi": None},  # bastk: list pdf/jpg, resi: single
        "cair": {"1": False, "2": False, "3": False},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.trips.insert_one(doc)
    return trip_doc_to_public(doc)


@api_router.get("/trips/{trip_id}")
async def get_trip(trip_id: str):
    doc = await db.trips.find_one({"trip_id": trip_id})
    if not doc:
        raise HTTPException(404, "Trip not found")
    return trip_doc_to_public(doc)


@api_router.post("/trips/{trip_id}/driver-name")
async def set_driver_name(trip_id: str, payload: DriverName):
    nama = payload.nama.strip()
    if not nama:
        raise HTTPException(400, "Nama tidak boleh kosong")
    res = await db.trips.update_one(
        {"trip_id": trip_id},
        {"$set": {"nama_driver": nama, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Trip not found")
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


@api_router.post("/trips/{trip_id}/sop-read")
async def mark_sop_read(trip_id: str):
    await db.trips.update_one({"trip_id": trip_id}, {"$set": {"sop_read": True, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}


def _save_upload(trip_id: str, sub: str, file: UploadFile, allowed: set) -> str:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed:
        raise HTTPException(400, f"Format file tidak didukung: {ext}")
    fname = f"{uuid.uuid4().hex}{ext}"
    folder = UPLOAD_DIR / trip_id / sub
    folder.mkdir(parents=True, exist_ok=True)
    fpath = folder / fname
    with fpath.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return f"/api/uploads/{trip_id}/{sub}/{fname}"


@api_router.post("/trips/{trip_id}/photos/initial")
async def upload_initial_photo(trip_id: str, slot: str = Form(...), foto: UploadFile = File(...)):
    """slot in: depan, belakang, kiri, kanan, spidometer, bbm"""
    valid_slots = {"depan", "belakang", "kiri", "kanan", "spidometer", "bbm"}
    if slot not in valid_slots:
        raise HTTPException(400, f"Slot tidak valid. Pilihan: {valid_slots}")
    trip = await db.trips.find_one({"trip_id": trip_id})
    if not trip:
        raise HTTPException(404, "Trip not found")
    url = _save_upload(trip_id, f"initial/{slot}", foto, ALLOWED_IMG)
    entry = {"url": url, "ts": datetime.now(timezone.utc).isoformat()}
    await db.trips.update_one(
        {"trip_id": trip_id},
        {"$set": {f"initial_photos.{slot}": entry, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    # auto-cair T1 kalau semua 6 initial sudah lengkap
    trip = await db.trips.find_one({"trip_id": trip_id})
    if all(s in (trip.get("initial_photos") or {}) for s in valid_slots) and not trip.get("cair", {}).get("1"):
        await db.trips.update_one({"trip_id": trip_id}, {"$set": {"cair.1": True}})
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


@api_router.post("/trips/{trip_id}/photos/daily")
async def upload_daily_photo(trip_id: str, foto: UploadFile = File(...)):
    trip = await db.trips.find_one({"trip_id": trip_id})
    if not trip:
        raise HTTPException(404, "Trip not found")
    today = today_wib()
    # cek apakah hari ini sudah ada
    daily = trip.get("daily_checkpoints") or []
    if any(cp.get("date") == today for cp in daily):
        raise HTTPException(409, "Foto hari ini sudah terkirim")
    url = _save_upload(trip_id, "daily", foto, ALLOWED_IMG)
    entry = {"id": str(uuid.uuid4()), "date": today, "url": url, "ts": datetime.now(timezone.utc).isoformat()}
    await db.trips.update_one(
        {"trip_id": trip_id},
        {"$push": {"daily_checkpoints": entry}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


@api_router.post("/trips/{trip_id}/photos/handover-bastk")
async def upload_bastk(trip_id: str, foto: UploadFile = File(...)):
    """BASTK: PDF atau gambar, max 6 file"""
    trip = await db.trips.find_one({"trip_id": trip_id})
    if not trip:
        raise HTTPException(404, "Trip not found")
    bastk = (trip.get("handover") or {}).get("bastk") or []
    if len(bastk) >= 6:
        raise HTTPException(400, "Maks 6 lembar BASTK")
    url = _save_upload(trip_id, "handover/bastk", foto, ALLOWED_IMG | ALLOWED_DOC)
    entry = {"id": str(uuid.uuid4()), "url": url, "ts": datetime.now(timezone.utc).isoformat()}
    await db.trips.update_one(
        {"trip_id": trip_id},
        {"$push": {"handover.bastk": entry}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


@api_router.post("/trips/{trip_id}/photos/handover-resi")
async def upload_resi(trip_id: str, foto: UploadFile = File(...)):
    trip = await db.trips.find_one({"trip_id": trip_id})
    if not trip:
        raise HTTPException(404, "Trip not found")
    url = _save_upload(trip_id, "handover/resi", foto, ALLOWED_IMG | ALLOWED_DOC)
    entry = {"url": url, "ts": datetime.now(timezone.utc).isoformat()}
    await db.trips.update_one(
        {"trip_id": trip_id},
        {"$set": {"handover.resi": entry, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


@api_router.post("/trips/{trip_id}/cair")
async def request_cair(trip_id: str, payload: CairBody):
    if payload.tahap not in (1, 2, 3):
        raise HTTPException(400, "Tahap harus 1, 2, atau 3")
    trip = await db.trips.find_one({"trip_id": trip_id})
    if not trip:
        raise HTTPException(404, "Trip not found")
    # Aturan minimal — gate sederhana
    if payload.tahap == 1:
        if len(trip.get("initial_photos") or {}) < 6:
            raise HTTPException(400, "Lengkapi 6 foto awal dulu")
    elif payload.tahap == 3:
        h = trip.get("handover") or {}
        if not h.get("bastk") or not h.get("resi"):
            raise HTTPException(400, "Upload BASTK & Resi dulu")
    await db.trips.update_one({"trip_id": trip_id}, {"$set": {f"cair.{payload.tahap}": True, "updated_at": datetime.now(timezone.utc).isoformat()}})
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


@api_router.delete("/trips/{trip_id}/daily/today")
async def reset_today_daily(trip_id: str):
    """Tester only — reset foto hari ini supaya bisa upload ulang."""
    today = today_wib()
    await db.trips.update_one({"trip_id": trip_id}, {"$pull": {"daily_checkpoints": {"date": today}}})
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


# ---------- Static file serving for uploads ----------
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

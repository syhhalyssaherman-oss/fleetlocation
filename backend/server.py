from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, shutil, asyncio
import requests as _requests
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone, timedelta
from odoo_client import OdooClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_IMG = {'.jpg', '.jpeg', '.png', '.webp', '.heic'}
ALLOWED_DOC = {'.pdf'}

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Optional Odoo webhook (admin can set this in backend/.env to e.g. https://alyssalogistik.co.id/odoo-proxy.php).
# When empty -> no-op (events only logged).
ODOO_WEBHOOK = os.environ.get("ODOO_WEBHOOK_URL", "").strip()

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)

# WIB timezone helper (UTC+7) for daily checkpoint
WIB = timezone(timedelta(hours=7))
def today_wib() -> str:
    return datetime.now(WIB).strftime("%Y-%m-%d")


async def notify_odoo(event: str, payload: dict) -> None:
    """Fire-and-forget event to admin's Odoo proxy. Never raises."""
    if not ODOO_WEBHOOK:
        logger.info(f"[odoo:skip] {event}: {payload}")
        return
    body = {"event": event, "data": payload, "ts": datetime.now(timezone.utc).isoformat()}
    def _post():
        try:
            _requests.post(ODOO_WEBHOOK, json=body, timeout=5)
        except Exception as e:
            logger.warning(f"[odoo:fail] {event}: {e}")
    try:
        await asyncio.to_thread(_post)
    except Exception as e:
        logger.warning(f"[odoo:dispatch_fail] {e}")


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
    tipe_kendaraan: str = ""
    no_rangka: str = ""
    legs: List[Dict[str, Any]] = []   # [{jalur, asal, tujuan, kapal, harga, status}]

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
    return {"message": "Alyssa Driver Checkpoint API", "v": "2.6b"}


VALID_STAGES = {"asal", "kapal", "tujuan", "dokumen"}


@api_router.post("/trips/init")
async def init_trip(payload: TripInit):
    """Idempotent — buat trip kalau belum ada, kalau sudah ada return existing."""
    existing = await db.trips.find_one({"trip_id": payload.trip_id})
    if existing:
        # ensure album field exists for legacy docs created before v2.2
        if "album" not in existing:
            await db.trips.update_one(
                {"trip_id": payload.trip_id},
                {"$set": {"album": {"asal": [], "kapal": [], "tujuan": [], "dokumen": []}}}
            )
            existing = await db.trips.find_one({"trip_id": payload.trip_id})
        return trip_doc_to_public(existing)
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "nama_driver": "",
        "sop_read": False,
        "initial_photos": {},
        "daily_checkpoints": [],
        "handover": {"bastk": [], "resi": None},
        # Album foto per tahap perjalanan (selaras dengan PO Admin PHP existing)
        "album": {"asal": [], "kapal": [], "tujuan": [], "dokumen": []},
        "cair": {"1": False, "2": False, "3": False},
        "xendit": {
            "t1": {"id": None, "status": None, "ts": None},
            "t2": {"id": None, "status": None, "ts": None},
            "t3": {"id": None, "status": None, "ts": None},
        },
        "odoo_synced": {"handover": False, "cair_1": False, "cair_2": False, "cair_3": False},
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
    """slot in: depan, belakang, kiri, kanan, spidometer (5 wajib)"""
    valid_slots = {"depan", "belakang", "kiri", "kanan", "spidometer"}
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
    initial_complete_now = all(s in (trip.get("initial_photos") or {}) for s in valid_slots)
    if initial_complete_now and not trip.get("cair", {}).get("1"):
        await db.trips.update_one({"trip_id": trip_id}, {"$set": {"cair.1": True}})
        # Notify Odoo: initial complete + T1 auto-cair
        await notify_odoo("trip.initial_complete", {
            "trip_id": trip_id,
            "nopol": trip.get("nopol"),
            "nama_driver": trip.get("nama_driver"),
            "tahap": 1,
            "amount": trip.get("t1", 0),
        })
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


@api_router.post("/trips/{trip_id}/photos/daily")
async def upload_daily_photo(
    trip_id: str,
    foto: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    status: Optional[str] = Form(None),  # Berangkat|Checkpoint 1|Checkpoint 2|Checkpoint 3|Tiba Tujuan
    keterangan: Optional[str] = Form(None),
):
    trip = await db.trips.find_one({"trip_id": trip_id})
    if not trip:
        raise HTTPException(404, "Trip not found")
    today = today_wib()
    daily = trip.get("daily_checkpoints") or []
    if any(cp.get("date") == today for cp in daily):
        raise HTTPException(409, "Foto hari ini sudah terkirim")
    url = _save_upload(trip_id, "daily", foto, ALLOWED_IMG)
    entry = {
        "id": str(uuid.uuid4()),
        "date": today,
        "url": url,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    if lat is not None and lng is not None:
        entry["lat"] = float(lat)
        entry["lng"] = float(lng)
    valid_status = {"Berangkat", "Checkpoint 1", "Checkpoint 2", "Checkpoint 3", "Tiba Tujuan"}
    if status and status in valid_status:
        entry["status"] = status
    if keterangan:
        entry["keterangan"] = keterangan.strip()[:300]
    await db.trips.update_one(
        {"trip_id": trip_id},
        {"$push": {"daily_checkpoints": entry}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


async def _maybe_notify_handover_complete(trip_id: str):
    """Trigger Odoo notification once when both BASTK + Resi are present (idempotent)."""
    trip = await db.trips.find_one({"trip_id": trip_id})
    if not trip:
        return
    h = trip.get("handover") or {}
    if h.get("bastk") and h.get("resi") and not (trip.get("odoo_synced") or {}).get("handover"):
        await db.trips.update_one({"trip_id": trip_id}, {"$set": {"odoo_synced.handover": True}})
        await notify_odoo("trip.handover_complete", {
            "trip_id": trip_id,
            "nopol": trip.get("nopol"),
            "nama_driver": trip.get("nama_driver"),
            "tipe_kendaraan": trip.get("tipe_kendaraan"),
            "no_rangka": trip.get("no_rangka"),
            "bastk_count": len(h.get("bastk", [])),
            "resi_url": (h.get("resi") or {}).get("url"),
        })


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
    await _maybe_notify_handover_complete(trip_id)
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
    await _maybe_notify_handover_complete(trip_id)
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
        if len(trip.get("initial_photos") or {}) < 5:
            raise HTTPException(400, "Lengkapi 5 foto awal dulu")
    elif payload.tahap == 3:
        h = trip.get("handover") or {}
        if not h.get("bastk") or not h.get("resi"):
            raise HTTPException(400, "Upload BASTK & Resi dulu")
    await db.trips.update_one({"trip_id": trip_id}, {"$set": {f"cair.{payload.tahap}": True, "updated_at": datetime.now(timezone.utc).isoformat()}})
    # Notify Odoo (once per tahap)
    sync_key = f"cair_{payload.tahap}"
    if not (trip.get("odoo_synced") or {}).get(sync_key):
        await db.trips.update_one({"trip_id": trip_id}, {"$set": {f"odoo_synced.{sync_key}": True}})
        amount_field = {1: "t1", 2: "t2", 3: "t3"}[payload.tahap]
        bonus = trip.get("bonus_kerajinan", 0) if payload.tahap == 3 else 0
        await notify_odoo("trip.cair", {
            "trip_id": trip_id,
            "nopol": trip.get("nopol"),
            "nama_driver": trip.get("nama_driver"),
            "tahap": payload.tahap,
            "amount": trip.get(amount_field, 0),
            "bonus": bonus,
            "total": trip.get(amount_field, 0) + bonus,
        })
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


# ---------- Xendit stub (legalitas dalam proses) ----------
@api_router.post("/trips/{trip_id}/xendit/disburse")
async def xendit_disburse(trip_id: str, payload: CairBody):
    """MOCKED — Xendit belum aktif. Endpoint ini cuma persist mock disbursement record.
    Saat legalitas Xendit selesai, ganti body fungsi ini dengan call ke Xendit SDK/REST API."""
    if payload.tahap not in (1, 2, 3):
        raise HTTPException(400, "Tahap harus 1, 2, atau 3")
    trip = await db.trips.find_one({"trip_id": trip_id})
    if not trip:
        raise HTTPException(404, "Trip not found")
    mock_id = f"xendit_mock_{uuid.uuid4().hex[:12]}"
    update = {
        f"xendit.t{payload.tahap}.id": mock_id,
        f"xendit.t{payload.tahap}.status": "MOCKED_PENDING",
        f"xendit.t{payload.tahap}.ts": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.trips.update_one({"trip_id": trip_id}, {"$set": update})
    doc = await db.trips.find_one({"trip_id": trip_id})
    return {
        "mocked": True,
        "disbursement_id": mock_id,
        "tahap": payload.tahap,
        "note": "Xendit belum aktif (legalitas dalam proses). Status: MOCKED_PENDING.",
        "trip": trip_doc_to_public(doc),
    }


# ---------- BASTK (Berita Acara Serah Terima Kendaraan) — v2.6a ADDITIVE ----------
VALID_VEHICLE_TYPES = {
    "Sedan", "MPV", "SUV", "Pickup", "Double Cabin", "CDD", "Truck Box",
    "Dump Truck", "Tangki", "Tronton", "Box Besar", "Canter", "Canter Pemadam",
    "Motor 2 Roda", "Motor 3 Roda", "Forklift", "Excavator", "Dozer",
    "Grader", "Vibro Roller",
}
VALID_DAMAGE_CODES = {"RSK", "B", "P", "PC", "CL", "L"}


class BASTKBody(BaseModel):
    vehicle_type: Optional[str] = None
    damage_marks: Optional[List[Dict[str, Any]]] = None
    customer_data: Optional[Dict[str, Any]] = None
    signatures: Optional[Dict[str, Any]] = None  # {driver: dataURL?, customer: dataURL?, admin: dataURL?, ts_driver/customer/admin}
    catatan: Optional[str] = None


@api_router.post("/trips/{trip_id}/bastk")
async def upsert_bastk(trip_id: str, payload: BASTKBody):
    """Save BASTK fields. Semua field optional — partial update friendly.
    NO breaking change: existing trips tanpa field ini tetap valid."""
    trip = await db.trips.find_one({"trip_id": trip_id})
    if not trip:
        raise HTTPException(404, "Trip not found")
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.vehicle_type is not None:
        vt = payload.vehicle_type.strip()
        if vt and vt not in VALID_VEHICLE_TYPES:
            raise HTTPException(400, f"vehicle_type tidak valid. Pilihan: {sorted(VALID_VEHICLE_TYPES)}")
        update["vehicle_type"] = vt
    if payload.damage_marks is not None:
        # filter only valid codes; coerce x/y to float; truncate note to 120
        clean = []
        for m in payload.damage_marks[:80]:  # cap 80 marks
            code = (m.get("code") or "").strip().upper()
            if code not in VALID_DAMAGE_CODES:
                continue
            try:
                x = float(m.get("x", 0)); y = float(m.get("y", 0))
            except Exception:
                continue
            clean.append({
                "id": m.get("id") or str(uuid.uuid4()),
                "code": code,
                "x": max(0.0, min(100.0, x)),  # percentage
                "y": max(0.0, min(100.0, y)),
                "note": (m.get("note") or "").strip()[:120],
            })
        update["damage_marks"] = clean
    if payload.customer_data is not None:
        # only whitelisted keys
        cd = payload.customer_data or {}
        update["customer_data"] = {
            "nama":     (cd.get("nama") or "").strip()[:120],
            "hp":       (cd.get("hp") or "").strip()[:30],
            "alamat":   (cd.get("alamat") or "").strip()[:300],
            "pic":      (cd.get("pic") or "").strip()[:120],
            "warna":    (cd.get("warna") or "").strip()[:40],
            "tahun":    (cd.get("tahun") or "").strip()[:6],
            "km":       (cd.get("km") or "").strip()[:12],
            "kondisi":  (cd.get("kondisi") or "").strip()[:20],
        }
    if payload.signatures is not None:
        sigs = payload.signatures or {}
        # store base64 dataURL strings — accept driver/customer/admin keys
        clean_sigs = {}
        for k in ("driver", "customer", "admin"):
            v = sigs.get(k)
            if isinstance(v, str) and v.startswith("data:image"):
                clean_sigs[k] = v[:400_000]  # max ~400KB dataURL
                clean_sigs[f"ts_{k}"] = datetime.now(timezone.utc).isoformat()
        if clean_sigs:
            update["signatures"] = {**(trip.get("signatures") or {}), **clean_sigs}
    if payload.catatan is not None:
        update["bastk_catatan"] = (payload.catatan or "").strip()[:500]

    await db.trips.update_one({"trip_id": trip_id}, {"$set": update})
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


@api_router.delete("/trips/{trip_id}/daily/today")
async def reset_today_daily(trip_id: str):
    """Tester only — reset foto hari ini supaya bisa upload ulang."""
    today = today_wib()
    await db.trips.update_one({"trip_id": trip_id}, {"$pull": {"daily_checkpoints": {"date": today}}})
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


# ---------- Album foto per tahap (Asal / Dalam Kapal / Tujuan / Dokumen) ----------
@api_router.post("/trips/{trip_id}/album")
async def upload_album_photo(
    trip_id: str,
    stage: str = Form(...),
    foto: UploadFile = File(...),
    catatan: str = Form(""),
    uploaded_by: str = Form("driver"),   # "driver" | "admin"
):
    """Upload foto ke album per tahap. Stage = asal|kapal|tujuan|dokumen.
    Dokumen menerima PDF + gambar; lainnya hanya gambar."""
    stage_norm = (stage or "").strip().lower()
    if stage_norm not in VALID_STAGES:
        raise HTTPException(400, f"Stage tidak valid. Pilihan: {sorted(VALID_STAGES)}")
    trip = await db.trips.find_one({"trip_id": trip_id})
    if not trip:
        raise HTTPException(404, "Trip not found")
    allowed = ALLOWED_IMG | ALLOWED_DOC if stage_norm == "dokumen" else ALLOWED_IMG
    url = _save_upload(trip_id, f"album/{stage_norm}", foto, allowed)
    entry = {
        "id": str(uuid.uuid4()),
        "url": url,
        "catatan": (catatan or "").strip(),
        "uploaded_by": uploaded_by or "driver",
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    await db.trips.update_one(
        {"trip_id": trip_id},
        {"$push": {f"album.{stage_norm}": entry}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


@api_router.delete("/trips/{trip_id}/album/{stage}/{photo_id}")
async def delete_album_photo(trip_id: str, stage: str, photo_id: str):
    stage_norm = (stage or "").strip().lower()
    if stage_norm not in VALID_STAGES:
        raise HTTPException(400, "Stage tidak valid.")
    res = await db.trips.update_one(
        {"trip_id": trip_id},
        {"$pull": {f"album.{stage_norm}": {"id": photo_id}}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Trip not found")
    doc = await db.trips.find_one({"trip_id": trip_id})
    return trip_doc_to_public(doc)


# ---------- Public tracking (read-only untuk pelanggan) ----------
@api_router.get("/public/trips/{trip_id}")
async def public_trip(trip_id: str):
    """Read-only view untuk pelanggan. Hanya field aman yang ter-expose."""
    doc = await db.trips.find_one({"trip_id": trip_id})
    if not doc:
        raise HTTPException(404, "Trip not found")
    h = doc.get("handover") or {}
    return {
        "trip_id": doc.get("trip_id"),
        "nopol": doc.get("nopol"),
        "tipe_kendaraan": doc.get("tipe_kendaraan", ""),
        "no_rangka": doc.get("no_rangka", ""),
        "route": doc.get("route", ""),
        "nama_driver": doc.get("nama_driver", ""),
        "legs": doc.get("legs", []),
        "album": doc.get("album", {"asal": [], "kapal": [], "tujuan": [], "dokumen": []}),
        "handover": {
            "bastk": h.get("bastk", []),
            "resi": h.get("resi"),
        },
        "daily_count": len(doc.get("daily_checkpoints", []) or []),
        "daily_checkpoints": doc.get("daily_checkpoints", []) or [],
        "initial_done": len(doc.get("initial_photos", {}) or {}),
        # BASTK fields (v2.6a, optional)
        "vehicle_type": doc.get("vehicle_type", ""),
        "damage_marks": doc.get("damage_marks", []),
        "customer_data": doc.get("customer_data", {}),
        "signatures": doc.get("signatures", {}),
        "bastk_catatan": doc.get("bastk_catatan", ""),
        "progress": {
            "initial_complete": len(doc.get("initial_photos", {}) or {}) >= 5,
            "handover_complete": bool(h.get("bastk")) and bool(h.get("resi")),
        },
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


@api_router.get("/odoo/ping")
async def odoo_ping():
    """Diagnostic: report Odoo client status. Safe to call always.
    When env empty → enabled=false. When set → tries server.version() (no auth).
    """
    return OdooClient().ping()


# ---------- Customer Order Form (v2.6b) ----------
class OrderBody(BaseModel):
    # Kendaraan
    vehicle_type: str
    nopol: str = ""
    no_rangka: str = ""
    warna: str = ""
    tahun: str = ""
    km: str = ""
    kondisi: str = "Bekas"
    # Asal
    asal_kota: str
    asal_alamat: str = ""
    pickup_date: str = ""        # ISO "YYYY-MM-DD"
    pickup_time: str = ""        # "HH:MM"
    pickup_pic: str = ""
    pickup_hp: str = ""
    # Tujuan
    tujuan_kota: str
    tujuan_alamat: str = ""
    delivery_pic: str = ""
    delivery_hp: str = ""
    # Customer
    customer_nama: str
    customer_hp: str
    customer_email: str = ""
    catatan: str = ""


@api_router.post("/orders")
async def create_order(payload: OrderBody):
    """Create a customer order (v2.6b). Validates + persists + fires Odoo webhook.
    Compatibility layer: returns order_id; does NOT auto-create trip yet (admin still triggers via PO).
    """
    vt = (payload.vehicle_type or "").strip()
    if vt and vt not in VALID_VEHICLE_TYPES:
        raise HTTPException(400, f"vehicle_type tidak valid. Pilihan: {sorted(VALID_VEHICLE_TYPES)}")
    if not (payload.asal_kota or "").strip():
        raise HTTPException(400, "asal_kota wajib diisi")
    if not (payload.tujuan_kota or "").strip():
        raise HTTPException(400, "tujuan_kota wajib diisi")
    if not (payload.customer_nama or "").strip():
        raise HTTPException(400, "customer_nama wajib diisi")
    if not (payload.customer_hp or "").strip():
        raise HTTPException(400, "customer_hp wajib diisi")

    order_id = f"ORD-{uuid.uuid4().hex[:10].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "order_id": order_id,
        "status": "NEW",                # NEW → CONFIRMED → DISPATCHED → COMPLETED → CANCELLED
        "vehicle_type": vt,
        "nopol": (payload.nopol or "").strip()[:20],
        "no_rangka": (payload.no_rangka or "").strip()[:40],
        "warna": (payload.warna or "").strip()[:40],
        "tahun": (payload.tahun or "").strip()[:6],
        "km": (payload.km or "").strip()[:12],
        "kondisi": (payload.kondisi or "Bekas").strip()[:20],
        "asal_kota": payload.asal_kota.strip()[:80],
        "asal_alamat": (payload.asal_alamat or "").strip()[:300],
        "pickup_date": (payload.pickup_date or "").strip()[:10],
        "pickup_time": (payload.pickup_time or "").strip()[:5],
        "pickup_pic": (payload.pickup_pic or "").strip()[:120],
        "pickup_hp": (payload.pickup_hp or "").strip()[:30],
        "tujuan_kota": payload.tujuan_kota.strip()[:80],
        "tujuan_alamat": (payload.tujuan_alamat or "").strip()[:300],
        "delivery_pic": (payload.delivery_pic or "").strip()[:120],
        "delivery_hp": (payload.delivery_hp or "").strip()[:30],
        "customer_nama": payload.customer_nama.strip()[:120],
        "customer_hp": payload.customer_hp.strip()[:30],
        "customer_email": (payload.customer_email or "").strip()[:120],
        "catatan": (payload.catatan or "").strip()[:500],
        "trip_id": None,                 # filled when admin converts order → trip
        "created_at": now,
        "updated_at": now,
    }
    await db.orders.insert_one(doc)
    # Fire Odoo webhook (no-op when ODOO_WEBHOOK_URL empty — see notify_odoo)
    await notify_odoo("order.created", {
        "order_id": order_id,
        "customer": {"nama": doc["customer_nama"], "hp": doc["customer_hp"], "email": doc["customer_email"]},
        "vehicle": {"type": doc["vehicle_type"], "nopol": doc["nopol"]},
        "route": f'{doc["asal_kota"]} → {doc["tujuan_kota"]}',
        "pickup": {"date": doc["pickup_date"], "time": doc["pickup_time"]},
    })
    doc.pop("_id", None)
    return doc


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    doc = await db.orders.find_one({"order_id": order_id})
    if not doc:
        raise HTTPException(404, "Order not found")
    doc.pop("_id", None)
    return doc


@api_router.get("/orders")
async def list_orders(limit: int = 50, status: Optional[str] = None):
    """Admin-friendly listing. Last 50 orders newest-first."""
    q = {}
    if status:
        q["status"] = status.strip().upper()[:20]
    cur = db.orders.find(q).sort("created_at", -1).limit(max(1, min(200, limit)))
    items = []
    async for d in cur:
        d.pop("_id", None)
        items.append(d)
    return {"count": len(items), "items": items}


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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class ManifestCreate(BaseModel):
    no_pol: str
    nama_driver: str
    asal: str
    tujuan: str
    muatan: str


class Manifest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    no_pol: str
    nama_driver: str
    asal: str
    tujuan: str
    muatan: str
    status: str = "active"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CheckpointCreate(BaseModel):
    manifest_id: Optional[str] = None
    no_pol: Optional[str] = None
    lat: float
    lng: float
    label: Optional[str] = None


class Checkpoint(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manifest_id: Optional[str] = None
    no_pol: Optional[str] = None
    lat: float
    lng: float
    label: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Driver Checkpoint API"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    rows = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for r in rows:
        if isinstance(r.get('timestamp'), str):
            r['timestamp'] = datetime.fromisoformat(r['timestamp'])
    return rows


# --- Manifests ---
@api_router.post("/manifests", response_model=Manifest)
async def create_manifest(payload: ManifestCreate):
    obj = Manifest(**payload.model_dump())
    await db.manifests.insert_one(obj.model_dump())
    return obj


@api_router.get("/manifests", response_model=List[Manifest])
async def list_manifests():
    rows = await db.manifests.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return rows


@api_router.get("/manifests/active", response_model=Optional[Manifest])
async def get_active_manifest():
    row = await db.manifests.find_one({"status": "active"}, {"_id": 0}, sort=[("created_at", -1)])
    return row


@api_router.post("/manifests/{manifest_id}/complete", response_model=Manifest)
async def complete_manifest(manifest_id: str):
    row = await db.manifests.find_one({"id": manifest_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Manifest not found")
    await db.manifests.update_one({"id": manifest_id}, {"$set": {"status": "completed"}})
    row["status"] = "completed"
    return row


# --- Checkpoints ---
@api_router.post("/checkpoints", response_model=Checkpoint)
async def create_checkpoint(payload: CheckpointCreate):
    obj = Checkpoint(**payload.model_dump())
    await db.checkpoints.insert_one(obj.model_dump())
    return obj


@api_router.get("/checkpoints", response_model=List[Checkpoint])
async def list_checkpoints(manifest_id: Optional[str] = None, limit: int = 200):
    q = {}
    if manifest_id:
        q["manifest_id"] = manifest_id
    rows = await db.checkpoints.find(q, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return rows


@api_router.delete("/checkpoints")
async def clear_checkpoints(manifest_id: Optional[str] = None):
    q = {}
    if manifest_id:
        q["manifest_id"] = manifest_id
    res = await db.checkpoints.delete_many(q)
    return {"deleted": res.deleted_count}


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

"""Driver Checkpoint v2 API tests"""
import os
import io
import uuid
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback to frontend env
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"


def _make_png_bytes() -> bytes:
    """Tiny valid 1x1 PNG"""
    def chunk(typ, data):
        crc = zlib.crc32(typ + data) & 0xffffffff
        return struct.pack('>I', len(data)) + typ + data + struct.pack('>I', crc)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
    raw = b'\x00\xff\x00\x00'
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend


def _make_jpeg_bytes() -> bytes:
    # minimal JPEG (gray pixel) - use a tiny known JPEG
    return bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605"
        "08070707090908"+ "0a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c2024"
        "2e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc000"
        "0b08000100010101110000ffc4001f0000010501010101010100000000000000"
        "000102030405060708090a0bffc400b5100002010303020403050504040000"
        "017d010203000411051221314106135161072271143281914223a1b1c10923"
        "33526272f1156374820810a162434e125f11718191a262728292a3536373839"
        "3a434445464748494a535455565758595a636465666768696a737475767778"
        "797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4"
        "b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7"
        "e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fbd0ffd9"
    )


PNG = _make_png_bytes()


@pytest.fixture(scope="module")
def trip_id():
    return f"TRIP-TEST-{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    yield s
    s.close()


def test_01_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("message") == "Alyssa Driver Checkpoint API"
    assert data.get("v") == "2.0"


def test_02_init_trip_new(session, trip_id):
    payload = {
        "trip_id": trip_id, "driver_id": "DRV-1", "nopol": "B 1234 ZZ",
        "route": "Jakarta - Surabaya", "uj": 3500000, "t1": 1750000, "t2": 1050000, "t3": 700000,
    }
    r = session.post(f"{API}/trips/init", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["trip_id"] == trip_id
    assert d["nopol"] == "B 1234 ZZ"
    assert d["nama_driver"] == ""
    assert d["sop_read"] is False
    assert d["initial_photos"] == {}
    assert d["daily_checkpoints"] == []
    assert d["handover"]["bastk"] == []
    assert d["handover"]["resi"] is None
    assert d["cair"] == {"1": False, "2": False, "3": False}
    assert "_id" not in d


def test_03_init_trip_idempotent(session, trip_id):
    r = session.post(f"{API}/trips/init", json={
        "trip_id": trip_id, "nopol": "B 9999 XX", "route": "X", "uj": 1, "t1": 1, "t2": 1, "t3": 1
    })
    assert r.status_code == 200
    d = r.json()
    # existing doc returned, not overwritten
    assert d["nopol"] == "B 1234 ZZ"
    assert d["t1"] == 1750000


def test_04_get_trip(session, trip_id):
    r = session.get(f"{API}/trips/{trip_id}")
    assert r.status_code == 200
    assert r.json()["trip_id"] == trip_id


def test_05_get_trip_404(session):
    r = session.get(f"{API}/trips/NONEXISTENT-{uuid.uuid4().hex}")
    assert r.status_code == 404


def test_06_set_driver_name(session, trip_id):
    r = session.post(f"{API}/trips/{trip_id}/driver-name", json={"nama": "Hermansyah"})
    assert r.status_code == 200
    assert r.json()["nama_driver"] == "Hermansyah"


def test_07_sop_read(session, trip_id):
    r = session.post(f"{API}/trips/{trip_id}/sop-read")
    assert r.status_code == 200
    g = session.get(f"{API}/trips/{trip_id}").json()
    assert g["sop_read"] is True


def test_08_upload_6_initial_and_auto_cair(session, trip_id):
    slots = ["depan", "belakang", "kiri", "kanan", "spidometer", "bbm"]
    last = None
    for s in slots:
        files = {"foto": (f"{s}.png", PNG, "image/png")}
        data = {"slot": s}
        r = session.post(f"{API}/trips/{trip_id}/photos/initial", data=data, files=files)
        assert r.status_code == 200, f"{s}: {r.text}"
        last = r.json()
        assert s in last["initial_photos"]
        assert last["initial_photos"][s]["url"].startswith(f"/api/uploads/{trip_id}/initial/{s}/")
    assert len(last["initial_photos"]) == 6
    assert last["cair"]["1"] is True  # auto cair


def test_09_upload_initial_bad_slot(session, trip_id):
    files = {"foto": ("x.png", PNG, "image/png")}
    r = session.post(f"{API}/trips/{trip_id}/photos/initial", data={"slot": "invalid"}, files=files)
    assert r.status_code == 400


def test_10_static_file_served(session, trip_id):
    g = session.get(f"{API}/trips/{trip_id}").json()
    url = g["initial_photos"]["depan"]["url"]
    r = session.get(f"{BASE_URL}{url}")
    assert r.status_code == 200
    assert len(r.content) > 0


def test_11_daily_upload(session, trip_id):
    # ensure clean slate
    session.delete(f"{API}/trips/{trip_id}/daily/today")
    files = {"foto": ("d.png", PNG, "image/png")}
    r = session.post(f"{API}/trips/{trip_id}/photos/daily", files=files)
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d["daily_checkpoints"]) >= 1


def test_12_daily_duplicate_same_day_409(session, trip_id):
    files = {"foto": ("d.png", PNG, "image/png")}
    r = session.post(f"{API}/trips/{trip_id}/photos/daily", files=files)
    assert r.status_code == 409
    assert "hari ini" in r.text.lower()


def test_13_delete_today_daily(session, trip_id):
    r = session.delete(f"{API}/trips/{trip_id}/daily/today")
    assert r.status_code == 200
    # Now upload should succeed again
    files = {"foto": ("d2.png", PNG, "image/png")}
    r2 = session.post(f"{API}/trips/{trip_id}/photos/daily", files=files)
    assert r2.status_code == 200


def test_14_bastk_upload(session, trip_id):
    for i in range(6):
        files = {"foto": (f"b{i}.png", PNG, "image/png")}
        r = session.post(f"{API}/trips/{trip_id}/photos/handover-bastk", files=files)
        assert r.status_code == 200, r.text
    # 7th must fail
    files = {"foto": ("b7.png", PNG, "image/png")}
    r = session.post(f"{API}/trips/{trip_id}/photos/handover-bastk", files=files)
    assert r.status_code == 400


def test_15_resi_upload(session, trip_id):
    files = {"foto": ("resi.png", PNG, "image/png")}
    r = session.post(f"{API}/trips/{trip_id}/photos/handover-resi", files=files)
    assert r.status_code == 200
    assert r.json()["handover"]["resi"] is not None


def test_16_cair_tahap_3_now_ok(session, trip_id):
    r = session.post(f"{API}/trips/{trip_id}/cair", json={"tahap": 3})
    assert r.status_code == 200
    assert r.json()["cair"]["3"] is True


def test_17_cair_gates_on_fresh_trip(session):
    # Fresh trip - no initials, expect cair.1 -> 400
    tid = f"TRIP-GATE-{uuid.uuid4().hex[:8]}"
    session.post(f"{API}/trips/init", json={"trip_id": tid, "nopol": "B 1 X", "route": "x"})
    r = session.post(f"{API}/trips/{tid}/cair", json={"tahap": 1})
    assert r.status_code == 400
    assert "foto awal" in r.text.lower()
    # tahap 3 also should fail (no bastk/resi)
    r3 = session.post(f"{API}/trips/{tid}/cair", json={"tahap": 3})
    assert r3.status_code == 400


def test_18_cleanup(session, trip_id):
    # No delete endpoint - leave data behind but verify trip still readable
    r = session.get(f"{API}/trips/{trip_id}")
    assert r.status_code == 200

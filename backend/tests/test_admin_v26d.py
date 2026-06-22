"""Backend tests for v2.6d Admin Mini-Dashboard (PIN-gated endpoints).

Covers:
- POST /api/admin/auth (PIN validation)
- GET  /api/admin/stats (counts by status)
- GET  /api/admin/orders (search + filter)
- PATCH /api/admin/orders/{id} (status / driver_id / catatan, mirror to trip)
- Auth guard on protected endpoints
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to public preview URL declared in frontend/.env
    from pathlib import Path
    env_file = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    for line in env_file.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break

API = f"{BASE_URL}/api"
ADMIN_PIN = os.environ.get("ADMIN_PIN", "0000")
H_GOOD = {"X-Admin-Pin": ADMIN_PIN}
H_BAD = {"X-Admin-Pin": "9999"}


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def seed_orders():
    """Create 3 TEST_ orders with distinct attributes. Cleanup at teardown."""
    created = []
    payloads = [
        {
            "vehicle_type": "Sedan",
            "customer_nama": "TEST_AdminBob",
            "customer_hp": "081234500001",
            "asal_kota": "Jakarta",
            "tujuan_kota": "Bandung",
            "nopol": "B 1111 TST",
        },
        {
            "vehicle_type": "MPV",
            "customer_nama": "TEST_AdminCindy",
            "customer_hp": "081234500002",
            "asal_kota": "Surabaya",
            "tujuan_kota": "Malang",
            "nopol": "L 2222 TST",
        },
        {
            "vehicle_type": "SUV",
            "customer_nama": "TEST_AdminDavid",
            "customer_hp": "081234500003",
            "asal_kota": "Medan",
            "tujuan_kota": "Bandung",
            "nopol": "BK 3333 TST",
        },
    ]
    for p in payloads:
        r = requests.post(f"{API}/orders", json=p, timeout=10)
        assert r.status_code in (200, 201), r.text
        created.append(r.json()["order_id"])

    yield created

    # Teardown: PATCH to CANCELLED then drop via direct mongo would need access; just leave with TEST_ prefix.
    # Best-effort: mark each CANCELLED so they don't pollute NEW count for subsequent runs.
    for oid in created:
        try:
            requests.patch(
                f"{API}/admin/orders/{oid}",
                json={"status": "CANCELLED"},
                headers=H_GOOD,
                timeout=5,
            )
        except Exception:
            pass


# ---------- /admin/auth ----------
class TestAdminAuth:
    def test_auth_correct_pin(self):
        r = requests.post(f"{API}/admin/auth", json={"pin": ADMIN_PIN}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}

    def test_auth_wrong_pin(self):
        r = requests.post(f"{API}/admin/auth", json={"pin": "9999"}, timeout=10)
        assert r.status_code == 401

    def test_auth_empty_pin(self):
        r = requests.post(f"{API}/admin/auth", json={"pin": ""}, timeout=10)
        assert r.status_code == 401


# ---------- Auth guard on protected endpoints ----------
class TestAdminGuard:
    def test_stats_without_pin(self):
        r = requests.get(f"{API}/admin/stats", timeout=10)
        assert r.status_code == 401

    def test_stats_with_wrong_pin(self):
        r = requests.get(f"{API}/admin/stats", headers=H_BAD, timeout=10)
        assert r.status_code == 401

    def test_orders_without_pin(self):
        r = requests.get(f"{API}/admin/orders", timeout=10)
        assert r.status_code == 401

    def test_patch_without_pin(self):
        r = requests.patch(f"{API}/admin/orders/NONEXIST", json={"status": "NEW"}, timeout=10)
        assert r.status_code == 401


# ---------- /admin/stats ----------
class TestAdminStats:
    def test_stats_shape(self, seed_orders):
        r = requests.get(f"{API}/admin/stats", headers=H_GOOD, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "total" in data
        assert "by_status" in data
        assert "trips_total" in data
        for s in ("NEW", "DISPATCHED", "ON_TRIP", "DELIVERED", "CANCELLED"):
            assert s in data["by_status"], f"missing status {s}"
            assert isinstance(data["by_status"][s], int)
        assert isinstance(data["total"], int)
        assert isinstance(data["trips_total"], int)
        # Total must equal sum of buckets
        assert data["total"] == sum(data["by_status"].values())


# ---------- /admin/orders (list + filter + search) ----------
class TestAdminOrdersList:
    def test_list_returns_items(self, seed_orders):
        r = requests.get(f"{API}/admin/orders", headers=H_GOOD, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "count" in data
        assert data["count"] == len(data["items"])
        ids = [o["order_id"] for o in data["items"]]
        # At least one seeded order should be in latest 100
        assert any(oid in ids for oid in seed_orders)
        # No _id leaks
        for it in data["items"]:
            assert "_id" not in it

    def test_filter_status_new(self, seed_orders):
        r = requests.get(f"{API}/admin/orders?status=NEW", headers=H_GOOD, timeout=10)
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it.get("status") == "NEW"

    def test_filter_status_invalid_returns_all(self, seed_orders):
        # Invalid status is silently ignored (no filter applied) per implementation
        r = requests.get(f"{API}/admin/orders?status=ZZZZ", headers=H_GOOD, timeout=10)
        assert r.status_code == 200

    def test_search_by_customer_name(self, seed_orders):
        r = requests.get(f"{API}/admin/orders?q=TEST_AdminBob", headers=H_GOOD, timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        assert any(i["customer_nama"] == "TEST_AdminBob" for i in items)

    def test_search_case_insensitive(self, seed_orders):
        r = requests.get(f"{API}/admin/orders?q=test_adminbob", headers=H_GOOD, timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(i["customer_nama"] == "TEST_AdminBob" for i in items)

    def test_search_by_nopol(self, seed_orders):
        r = requests.get(f"{API}/admin/orders?q=2222", headers=H_GOOD, timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        assert any("2222" in (i.get("nopol") or "") for i in items)

    def test_search_by_order_id(self, seed_orders):
        target = seed_orders[0]
        r = requests.get(f"{API}/admin/orders?q={target}", headers=H_GOOD, timeout=10)
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(i["order_id"] == target for i in items)

    def test_limit_clamp(self, seed_orders):
        r = requests.get(f"{API}/admin/orders?limit=999", headers=H_GOOD, timeout=10)
        assert r.status_code == 200
        assert len(r.json()["items"]) <= 500


# ---------- PATCH /admin/orders/{id} ----------
class TestAdminPatchOrder:
    def test_patch_status_persists(self, seed_orders):
        oid = seed_orders[1]
        r = requests.patch(
            f"{API}/admin/orders/{oid}",
            json={"status": "DISPATCHED"},
            headers=H_GOOD,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "DISPATCHED"
        # Verify persistence via list filter
        rl = requests.get(f"{API}/admin/orders?q={oid}", headers=H_GOOD, timeout=10)
        items = rl.json()["items"]
        assert any(i["order_id"] == oid and i["status"] == "DISPATCHED" for i in items)

    def test_patch_invalid_status(self, seed_orders):
        oid = seed_orders[0]
        r = requests.patch(
            f"{API}/admin/orders/{oid}",
            json={"status": "FOOBAR"},
            headers=H_GOOD,
            timeout=10,
        )
        assert r.status_code == 400

    def test_patch_unknown_order(self):
        r = requests.patch(
            f"{API}/admin/orders/ORD-DOES-NOT-EXIST-XYZ",
            json={"status": "NEW"},
            headers=H_GOOD,
            timeout=10,
        )
        assert r.status_code == 404

    def test_patch_empty_body_400(self, seed_orders):
        oid = seed_orders[0]
        r = requests.patch(
            f"{API}/admin/orders/{oid}",
            json={},
            headers=H_GOOD,
            timeout=10,
        )
        assert r.status_code == 400

    def test_patch_driver_id_and_catatan(self, seed_orders):
        oid = seed_orders[2]
        r = requests.patch(
            f"{API}/admin/orders/{oid}",
            json={"driver_id": "DRV-TEST-001", "catatan": "test note"},
            headers=H_GOOD,
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["driver_id"] == "DRV-TEST-001"
        assert body["catatan"] == "test note"

    def test_convert_then_patch_mirrors_driver_to_trip(self, seed_orders):
        """Convert order → trip, then PATCH driver_id, verify mirror to trip."""
        # Create a fresh order to convert (don't reuse seeded ones potentially cancelled)
        r0 = requests.post(
            f"{API}/orders",
            json={
                "vehicle_type": "Sedan",
                "customer_nama": "TEST_AdminConvert",
                "customer_hp": "081234599999",
                "asal_kota": "Jakarta",
                "tujuan_kota": "Semarang",
                "nopol": "B 9999 ZZ",
            },
            timeout=10,
        )
        assert r0.status_code in (200, 201)
        oid = r0.json()["order_id"]

        # Convert
        rc = requests.post(f"{API}/orders/{oid}/convert", json={}, timeout=15)
        assert rc.status_code == 200, rc.text
        tid = rc.json().get("trip_id")
        assert tid

        # Patch driver_id
        rp = requests.patch(
            f"{API}/admin/orders/{oid}",
            json={"driver_id": "DRV-MIRROR-77"},
            headers=H_GOOD,
            timeout=10,
        )
        assert rp.status_code == 200
        assert rp.json()["driver_id"] == "DRV-MIRROR-77"

        # Verify mirrored to trip
        rt = requests.get(f"{API}/trips/{tid}", timeout=10)
        assert rt.status_code == 200
        assert rt.json().get("driver_id") == "DRV-MIRROR-77"

        # Cleanup
        requests.patch(
            f"{API}/admin/orders/{oid}",
            json={"status": "CANCELLED"},
            headers=H_GOOD,
            timeout=5,
        )


# ---------- Regression: public endpoints still work without PIN ----------
class TestPublicRegression:
    def test_root_version(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200

    def test_create_order_no_pin(self):
        r = requests.post(
            f"{API}/orders",
            json={
                "vehicle_type": "Sedan",
                "customer_nama": "TEST_RegPublic",
                "customer_hp": "08000000000",
                "asal_kota": "A",
                "tujuan_kota": "B",
                "nopol": "X 0000 YY",
            },
            timeout=10,
        )
        assert r.status_code in (200, 201)
        assert "order_id" in r.json()

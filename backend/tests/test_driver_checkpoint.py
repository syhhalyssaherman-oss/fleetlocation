"""Backend tests for Driver Checkpoint API (manifests + checkpoints)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fleet-location-app-2.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Health ---
def test_root_endpoint(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("message") == "Driver Checkpoint API"


# --- Manifest CRUD ---
class TestManifests:
    created_id = None
    no_pol = "TEST B 9999 ZZ"

    def test_create_manifest(self, session):
        payload = {
            "no_pol": self.no_pol,
            "nama_driver": "TEST Driver",
            "asal": "Jakarta",
            "tujuan": "Bandung",
            "muatan": "TEST cargo",
        }
        r = session.post(f"{API}/manifests", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["no_pol"] == self.no_pol
        assert data["nama_driver"] == "TEST Driver"
        assert data["status"] == "active"
        assert "id" in data and isinstance(data["id"], str)
        assert "created_at" in data
        TestManifests.created_id = data["id"]

    def test_get_active_manifest(self, session):
        r = session.get(f"{API}/manifests/active")
        assert r.status_code == 200
        data = r.json()
        assert data is not None
        # Latest active manifest must be the one just created
        assert data["id"] == TestManifests.created_id
        assert data["status"] == "active"

    def test_list_manifests(self, session):
        r = session.get(f"{API}/manifests")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert any(m["id"] == TestManifests.created_id for m in rows)


# --- Checkpoint flow tied to created manifest ---
class TestCheckpoints:
    created_chk_ids = []

    def test_create_checkpoint(self, session):
        mid = TestManifests.created_id
        assert mid, "Manifest must be created first"
        payload = {
            "manifest_id": mid,
            "no_pol": TestManifests.no_pol,
            "lat": -6.2,
            "lng": 106.8166,
            "label": "CP-1",
        }
        r = session.post(f"{API}/checkpoints", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["manifest_id"] == mid
        assert data["lat"] == -6.2
        assert data["lng"] == 106.8166
        assert data["label"] == "CP-1"
        assert "id" in data
        assert isinstance(data["timestamp"], str) and "T" in data["timestamp"]
        TestCheckpoints.created_chk_ids.append(data["id"])

    def test_create_second_checkpoint(self, session):
        mid = TestManifests.created_id
        payload = {
            "manifest_id": mid,
            "no_pol": TestManifests.no_pol,
            "lat": -6.21,
            "lng": 106.82,
            "label": "CP-2",
        }
        r = session.post(f"{API}/checkpoints", json=payload)
        assert r.status_code == 200
        TestCheckpoints.created_chk_ids.append(r.json()["id"])

    def test_list_checkpoints_sorted_desc(self, session):
        mid = TestManifests.created_id
        r = session.get(f"{API}/checkpoints", params={"manifest_id": mid})
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 2
        # Timestamp desc => first ts >= second ts
        assert rows[0]["timestamp"] >= rows[1]["timestamp"]
        # All checkpoints belong to manifest
        for row in rows:
            assert row["manifest_id"] == mid


# --- Complete + cleanup ---
class TestCompleteAndCleanup:
    def test_complete_manifest(self, session):
        mid = TestManifests.created_id
        r = session.post(f"{API}/manifests/{mid}/complete")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "completed"

    def test_complete_not_found(self, session):
        r = session.post(f"{API}/manifests/non-existent-id-xxx/complete")
        assert r.status_code == 404

    def test_active_manifest_after_complete(self, session):
        # active should no longer be our completed one
        r = session.get(f"{API}/manifests/active")
        assert r.status_code == 200
        data = r.json()
        if data is not None:
            assert data["id"] != TestManifests.created_id

    def test_cleanup_checkpoints(self, session):
        mid = TestManifests.created_id
        r = session.delete(f"{API}/checkpoints", params={"manifest_id": mid})
        assert r.status_code == 200
        assert r.json()["deleted"] >= 2

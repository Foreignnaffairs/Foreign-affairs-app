"""Iteration 3 — Admin PIN-gated CRUD + past-flight rules.

Covers:
  - GET /api/flights returns past + upcoming (sorted by departure).
  - POST /api/admin/verify-pin with valid / invalid PIN.
  - Admin endpoints (list/create/update/delete/reset-seats) require the
    X-Admin-PIN header (401 without / wrong, 200 with correct).
  - Creating a flight respects business_tables (max 12) / first_booths (max 4).
  - Updating a flight preserves already-booked seats.
  - Reset-seats sets all seats to available and class.booked=0.
  - POST /api/bookings on a past flight -> 400.
  - Booking on an upcoming flight still succeeds (economy walk-in + business).
"""
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
PIN = "602214"
BAD_PIN = "000000"


# ---------------- fixtures ----------------
@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def _cleanup(client, created_ids):
    yield
    for fid in created_ids:
        try:
            client.delete(f"{API}/admin/flights/{fid}", headers={"X-Admin-PIN": PIN}, timeout=10)
        except Exception:
            pass


def _future_iso(days=20, hours=22):
    return (datetime.now(timezone.utc) + timedelta(days=days, hours=hours)).isoformat()


def _new_payload(**over):
    p = {
        "flight_number": "FA TEST",
        "destination": "TEST_Manila",
        "tagline": "Test tagline",
        "pilot": "DJ TEST",
        "genres": ["Test"],
        "venue": "Stardust, BGC",
        "gate": "Z9",
        "terminal": "T9",
        "departure": _future_iso(),
        "duration": "6h set",
        "image_url": "https://example.com/x.jpg",
        "description": "Test flight",
        "gallery_url": "",
        "economy_price": 0,
        "business_price": 2500,
        "first_price": 15000,
        "economy_capacity": 400,
        "business_tables": 12,
        "first_booths": 4,
    }
    p.update(over)
    return p


# ---------------- public flights ----------------
class TestPublicFlights:
    def test_list_includes_past_and_upcoming_sorted(self, client):
        r = client.get(f"{API}/flights", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 5
        # sorted asc by departure
        deps = [f["departure"] for f in data]
        assert deps == sorted(deps), "flights must be sorted by departure asc"
        # Seoul FA 019 is past with gallery
        seoul = next((f for f in data if f["destination"] == "Seoul"), None)
        assert seoul is not None, "Seoul (past) seed flight missing"
        assert seoul["departure"] < datetime.now(timezone.utc).isoformat()
        assert "drive.google.com" in seoul["gallery_url"]

    def test_upcoming_present(self, client):
        r = client.get(f"{API}/flights", timeout=10)
        dests = {f["destination"] for f in r.json()}
        for d in ("Tokyo", "Lagos", "Berlin", "Rio"):
            assert d in dests


# ---------------- PIN verify ----------------
class TestVerifyPin:
    def test_valid(self, client):
        r = client.post(f"{API}/admin/verify-pin", json={"pin": PIN}, timeout=10)
        assert r.status_code == 200 and r.json() == {"valid": True}

    def test_invalid(self, client):
        r = client.post(f"{API}/admin/verify-pin", json={"pin": BAD_PIN}, timeout=10)
        assert r.status_code == 200 and r.json() == {"valid": False}

    def test_empty(self, client):
        r = client.post(f"{API}/admin/verify-pin", json={"pin": ""}, timeout=10)
        assert r.status_code == 200 and r.json() == {"valid": False}


# ---------------- Admin auth guard ----------------
class TestAdminAuth:
    def test_list_without_pin(self, client):
        r = client.get(f"{API}/admin/flights", timeout=10)
        assert r.status_code == 401

    def test_list_wrong_pin(self, client):
        r = client.get(f"{API}/admin/flights", headers={"X-Admin-PIN": BAD_PIN}, timeout=10)
        assert r.status_code == 401

    def test_list_correct_pin(self, client):
        r = client.get(f"{API}/admin/flights", headers={"X-Admin-PIN": PIN}, timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_requires_pin(self, client):
        r = client.post(f"{API}/admin/flights", json=_new_payload(), timeout=10)
        assert r.status_code == 401

    def test_update_requires_pin(self, client):
        r = client.put(f"{API}/admin/flights/does-not-matter", json=_new_payload(), timeout=10)
        assert r.status_code == 401

    def test_delete_requires_pin(self, client):
        r = client.delete(f"{API}/admin/flights/does-not-matter", timeout=10)
        assert r.status_code == 401

    def test_reset_requires_pin(self, client):
        r = client.post(f"{API}/admin/flights/does-not-matter/reset-seats", timeout=10)
        assert r.status_code == 401


# ---------------- Admin CRUD ----------------
class TestAdminCreate:
    def test_create_flight_generates_seats(self, client, created_ids):
        payload = _new_payload(destination="TEST_Create1", business_tables=5, first_booths=2)
        r = client.post(f"{API}/admin/flights", json=payload, headers={"X-Admin-PIN": PIN}, timeout=10)
        assert r.status_code == 200, r.text
        f = r.json()
        created_ids.append(f["id"])
        # 5 business + 2 first = 7 seats
        assert len(f["seats"]) == 7
        assert sum(1 for s in f["seats"] if s["class_key"] == "business") == 5
        assert sum(1 for s in f["seats"] if s["class_key"] == "first") == 2
        biz = next(c for c in f["classes"] if c["key"] == "business")
        first = next(c for c in f["classes"] if c["key"] == "first")
        eco = next(c for c in f["classes"] if c["key"] == "economy")
        assert biz["capacity"] == 5 and first["capacity"] == 2
        assert eco["price"] == 0

        # GET verifies persistence
        g = client.get(f"{API}/flights/{f['id']}", timeout=10)
        assert g.status_code == 200
        assert g.json()["destination"] == "TEST_Create1"

    def test_create_clamps_business_and_first(self, client, created_ids):
        r = client.post(
            f"{API}/admin/flights",
            json=_new_payload(destination="TEST_Clamp", business_tables=99, first_booths=99),
            headers={"X-Admin-PIN": PIN},
            timeout=10,
        )
        assert r.status_code == 200
        f = r.json()
        created_ids.append(f["id"])
        biz = next(c for c in f["classes"] if c["key"] == "business")
        first = next(c for c in f["classes"] if c["key"] == "first")
        assert biz["capacity"] == 12
        assert first["capacity"] == 4
        assert len(f["seats"]) == 16


class TestAdminUpdate:
    def test_update_preserves_booked_seats(self, client, created_ids):
        # Create then book Table 1
        c = client.post(
            f"{API}/admin/flights",
            json=_new_payload(destination="TEST_Preserve"),
            headers={"X-Admin-PIN": PIN},
            timeout=10,
        )
        assert c.status_code == 200
        f = c.json()
        created_ids.append(f["id"])
        b = client.post(
            f"{API}/bookings",
            json={
                "flight_id": f["id"],
                "class_key": "business",
                "seat_labels": ["1"],
                "passenger_name": "TEST_UpdateGuard",
                "passenger_phone": "+639170000IT3",
            },
            timeout=10,
        )
        assert b.status_code == 200, b.text

        # Update the flight — Table 1 must remain booked
        up = client.put(
            f"{API}/admin/flights/{f['id']}",
            json=_new_payload(destination="TEST_PreserveUpdated"),
            headers={"X-Admin-PIN": PIN},
            timeout=10,
        )
        assert up.status_code == 200
        f2 = up.json()
        assert f2["destination"] == "TEST_PreserveUpdated"
        seat1 = next(s for s in f2["seats"] if s["label"] == "1" and s["class_key"] == "business")
        assert seat1["status"] == "booked"
        biz = next(c for c in f2["classes"] if c["key"] == "business")
        assert biz["booked"] >= 1


class TestAdminReset:
    def test_reset_seats_clears_bookings(self, client, created_ids):
        c = client.post(
            f"{API}/admin/flights",
            json=_new_payload(destination="TEST_Reset"),
            headers={"X-Admin-PIN": PIN},
            timeout=10,
        )
        f = c.json()
        created_ids.append(f["id"])
        client.post(
            f"{API}/bookings",
            json={
                "flight_id": f["id"],
                "class_key": "business",
                "seat_labels": ["2"],
                "passenger_name": "TEST_Reset",
                "passenger_phone": "+639170000IT3",
            },
            timeout=10,
        )
        r = client.post(
            f"{API}/admin/flights/{f['id']}/reset-seats",
            headers={"X-Admin-PIN": PIN},
            timeout=10,
        )
        assert r.status_code == 200
        f2 = r.json()
        assert all(s["status"] == "available" for s in f2["seats"])
        for cls in f2["classes"]:
            assert cls["booked"] == 0


class TestAdminDelete:
    def test_delete_flight(self, client):
        c = client.post(
            f"{API}/admin/flights",
            json=_new_payload(destination="TEST_Delete"),
            headers={"X-Admin-PIN": PIN},
            timeout=10,
        )
        fid = c.json()["id"]
        d = client.delete(f"{API}/admin/flights/{fid}", headers={"X-Admin-PIN": PIN}, timeout=10)
        assert d.status_code == 200 and d.json() == {"ok": True}
        g = client.get(f"{API}/flights/{fid}", timeout=10)
        assert g.status_code == 404

    def test_delete_missing(self, client):
        r = client.delete(f"{API}/admin/flights/nope-nope", headers={"X-Admin-PIN": PIN}, timeout=10)
        assert r.status_code == 404


# ---------------- Past flight booking rule ----------------
class TestPastFlightBooking:
    def test_booking_past_flight_returns_400(self, client):
        flights = client.get(f"{API}/flights", timeout=10).json()
        seoul = next(f for f in flights if f["destination"] == "Seoul")
        r = client.post(
            f"{API}/bookings",
            json={
                "flight_id": seoul["id"],
                "class_key": "economy",
                "quantity": 1,
                "passenger_name": "TEST_Past",
                "passenger_phone": "+639170000IT3",
            },
            timeout=10,
        )
        assert r.status_code == 400
        assert "departed" in r.json().get("detail", "").lower()

    def test_booking_upcoming_still_works(self, client, created_ids):
        # Use a freshly-created upcoming flight so we don't collide with other tests.
        c = client.post(
            f"{API}/admin/flights",
            json=_new_payload(destination="TEST_UpcomingBook"),
            headers={"X-Admin-PIN": PIN},
            timeout=10,
        )
        f = c.json()
        created_ids.append(f["id"])
        # Economy walk-in
        eco = client.post(
            f"{API}/bookings",
            json={
                "flight_id": f["id"],
                "class_key": "economy",
                "quantity": 2,
                "passenger_name": "TEST_UpEco",
                "passenger_phone": "+639170000IT3",
            },
            timeout=10,
        )
        assert eco.status_code == 200, eco.text
        assert eco.json()["seat_label"] == "WALK-IN"
        assert eco.json()["total"] == 0
        # Business with a seat_label
        biz = client.post(
            f"{API}/bookings",
            json={
                "flight_id": f["id"],
                "class_key": "business",
                "seat_labels": ["3"],
                "passenger_name": "TEST_UpBiz",
                "passenger_phone": "+639170000IT3",
            },
            timeout=10,
        )
        assert biz.status_code == 200, biz.text
        assert "Table 3" in biz.json()["seat_label"]
        assert biz.json()["total"] == 2500

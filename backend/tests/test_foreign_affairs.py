"""Backend API tests for Foreign Affairs flight-booking app."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://seat-reserve-67.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def flights(client):
    r = client.get(f"{API}/flights", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) >= 4
    return data


# ---------------- Flights ----------------
class TestFlights:
    def test_list_flights_seeded(self, flights):
        destinations = {f["destination"] for f in flights}
        assert {"Tokyo", "Lagos", "Berlin", "Rio"}.issubset(destinations)

    def test_flights_sorted_by_departure(self, flights):
        deps = [f["departure"] for f in flights]
        assert deps == sorted(deps)

    def test_each_flight_has_three_classes(self, flights):
        for f in flights:
            keys = {c["key"] for c in f["classes"]}
            assert keys == {"economy", "business", "first"}, f"Flight {f['flight_number']} missing classes"

    def test_get_single_flight(self, client, flights):
        fid = flights[0]["id"]
        r = client.get(f"{API}/flights/{fid}", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == fid
        assert len(body["classes"]) == 3

    def test_get_unknown_flight_404(self, client):
        r = client.get(f"{API}/flights/nonexistent-id", timeout=10)
        assert r.status_code == 404


# ---------------- Bookings ----------------
class TestBookings:
    TEST_PHONE = "+639170000TEST"
    created_booking = {}

    def test_create_booking_economy(self, client, flights):
        f = flights[0]
        eco = next(c for c in f["classes"] if c["key"] == "economy")
        remaining_before = eco["capacity"] - eco["booked"]
        payload = {
            "flight_id": f["id"],
            "class_key": "economy",
            "quantity": 2,
            "passenger_name": "TEST User",
            "passenger_phone": self.TEST_PHONE,
        }
        r = client.post(f"{API}/bookings", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["reference"].startswith("FA")
        assert b["quantity"] == 2
        assert b["total"] == eco["price"] * 2
        assert b["seat_label"].startswith("S")
        assert "-" in b["seat_label"]  # range for qty>1
        assert b["status"] == "CONFIRMED"
        TestBookings.created_booking = b

        # verify decrement via GET flight
        r2 = client.get(f"{API}/flights/{f['id']}")
        eco_after = next(c for c in r2.json()["classes"] if c["key"] == "economy")
        assert (eco_after["capacity"] - eco_after["booked"]) == remaining_before - 2

    def test_create_booking_business_single(self, client, flights):
        f = flights[1]
        payload = {
            "flight_id": f["id"],
            "class_key": "business",
            "quantity": 1,
            "passenger_name": "TEST Biz",
            "passenger_phone": self.TEST_PHONE,
        }
        r = client.post(f"{API}/bookings", json=payload, timeout=15)
        assert r.status_code == 200
        b = r.json()
        assert b["seat_label"].startswith("T")
        assert "-" not in b["seat_label"]
        assert b["unit"] == "table"

    def test_invalid_class_400(self, client, flights):
        payload = {
            "flight_id": flights[0]["id"],
            "class_key": "nonsense",
            "quantity": 1,
            "passenger_name": "TEST",
            "passenger_phone": self.TEST_PHONE,
        }
        r = client.post(f"{API}/bookings", json=payload, timeout=10)
        assert r.status_code == 400

    def test_unknown_flight_404(self, client):
        payload = {
            "flight_id": "no-such-flight-id",
            "class_key": "economy",
            "quantity": 1,
            "passenger_name": "TEST",
            "passenger_phone": self.TEST_PHONE,
        }
        r = client.post(f"{API}/bookings", json=payload, timeout=10)
        assert r.status_code == 404

    def test_overbook_409(self, client, flights):
        # first class has small capacity, ask for huge qty
        f = flights[2]
        first = next(c for c in f["classes"] if c["key"] == "first")
        payload = {
            "flight_id": f["id"],
            "class_key": "first",
            "quantity": first["capacity"] + 5,
            "passenger_name": "TEST Over",
            "passenger_phone": self.TEST_PHONE,
        }
        r = client.post(f"{API}/bookings", json=payload, timeout=10)
        assert r.status_code == 409

    def test_get_bookings_by_phone(self, client):
        r = client.get(f"{API}/bookings", params={"phone": self.TEST_PHONE}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 2
        for b in data:
            assert b["passenger_phone"] == self.TEST_PHONE

    def test_get_booking_by_id(self, client):
        bid = TestBookings.created_booking.get("id")
        assert bid
        r = client.get(f"{API}/bookings/{bid}", timeout=10)
        assert r.status_code == 200
        assert r.json()["id"] == bid

    def test_get_booking_unknown_404(self, client):
        r = client.get(f"{API}/bookings/no-such-id", timeout=10)
        assert r.status_code == 404

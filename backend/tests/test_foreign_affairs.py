"""Backend API tests for Foreign Affairs — iteration 2 (per-seat inventory + floor plan)."""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

TEST_PHONE = "+639170000IT2"


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


def _first_available_seat(flight, class_key):
    return next(s for s in flight["seats"] if s["class_key"] == class_key and s["status"] == "available")


def _get_flight(client, fid):
    r = client.get(f"{API}/flights/{fid}", timeout=10)
    assert r.status_code == 200
    return r.json()


# ---------------- Flights + seats shape ----------------
class TestFlightsShape:
    def test_list_flights_seeded(self, flights):
        destinations = {f["destination"] for f in flights}
        assert {"Tokyo", "Lagos", "Berlin", "Rio"}.issubset(destinations)

    def test_flights_sorted_by_departure(self, flights):
        deps = [f["departure"] for f in flights]
        assert deps == sorted(deps)

    def test_each_flight_has_three_classes(self, flights):
        for f in flights:
            keys = {c["key"] for c in f["classes"]}
            assert keys == {"economy", "business", "first"}

    def test_each_flight_has_16_seats(self, flights):
        for f in flights:
            seats = f["seats"]
            assert len(seats) == 16, f"{f['flight_number']} seats={len(seats)}"
            biz = [s for s in seats if s["class_key"] == "business"]
            first = [s for s in seats if s["class_key"] == "first"]
            assert len(biz) == 12
            assert len(first) == 4
            biz_labels = {s["label"] for s in biz}
            assert biz_labels == {str(i) for i in range(1, 13)}
            first_labels = {s["label"] for s in first}
            assert first_labels == {f"FC{i}" for i in range(1, 5)}
            # x,y in 0..1
            for s in seats:
                assert 0.0 <= s["x"] <= 1.0
                assert 0.0 <= s["y"] <= 1.0
                assert s["status"] in ("available", "booked")
            # display names
            t1 = next(s for s in biz if s["label"] == "1")
            assert t1["name"] == "Table 1"
            fc1 = next(s for s in first if s["label"] == "FC1")
            assert fc1["name"] == "First Class 1"


# ---------------- Bookings — new seat_labels logic ----------------
class TestBookings:
    created_booking_id = None

    def test_economy_walkin(self, client, flights):
        f = _get_flight(client, flights[0]["id"])
        eco_before = next(c for c in f["classes"] if c["key"] == "economy")
        payload = {
            "flight_id": f["id"],
            "class_key": "economy",
            "quantity": 3,
            "passenger_name": "TEST Eco",
            "passenger_phone": TEST_PHONE,
        }
        r = client.post(f"{API}/bookings", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["total"] == 0
        assert b["seat_label"] == "WALK-IN"
        assert b["quantity"] == 3
        assert b["class_key"] == "economy"
        # eco booked incremented by 3
        f2 = _get_flight(client, f["id"])
        eco_after = next(c for c in f2["classes"] if c["key"] == "economy")
        assert eco_after["booked"] == eco_before["booked"] + 3
        TestBookings.created_booking_id = b["id"]

    def test_business_specific_seat(self, client, flights):
        # pick a flight & an available business seat
        f = _get_flight(client, flights[1]["id"])
        seat = _first_available_seat(f, "business")
        payload = {
            "flight_id": f["id"],
            "class_key": "business",
            "seat_labels": [seat["label"]],
            "passenger_name": "TEST Biz",
            "passenger_phone": TEST_PHONE,
        }
        r = client.post(f"{API}/bookings", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["total"] == 2500
        assert b["quantity"] == 1
        assert b["seat_label"] == f"Table {seat['label']}"
        assert b["unit"] == "table"
        # confirm seat is booked now
        f2 = _get_flight(client, f["id"])
        s2 = next(s for s in f2["seats"] if s["label"] == seat["label"])
        assert s2["status"] == "booked"

    def test_first_two_booths(self, client, flights):
        f = _get_flight(client, flights[2]["id"])
        avail = [s for s in f["seats"] if s["class_key"] == "first" and s["status"] == "available"]
        assert len(avail) >= 2, "need >=2 available FC booths for this test"
        labels = [avail[0]["label"], avail[1]["label"]]
        payload = {
            "flight_id": f["id"],
            "class_key": "first",
            "seat_labels": labels,
            "passenger_name": "TEST First",
            "passenger_phone": TEST_PHONE,
        }
        r = client.post(f"{API}/bookings", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["total"] == 30000
        assert b["quantity"] == 2
        expected_name = ", ".join(f"First Class {l[2:]}" for l in labels)
        assert b["seat_label"] == expected_name
        assert b["unit"] == "booth"
        # confirm both booked
        f2 = _get_flight(client, f["id"])
        for lbl in labels:
            s2 = next(s for s in f2["seats"] if s["label"] == lbl)
            assert s2["status"] == "booked"

    def test_double_book_409(self, client, flights):
        # Reuse flights[1] with an already-booked seat if exists, otherwise book+rebook
        f = _get_flight(client, flights[1]["id"])
        booked = [s for s in f["seats"] if s["class_key"] == "business" and s["status"] == "booked"]
        if not booked:
            avail = _first_available_seat(f, "business")
            client.post(
                f"{API}/bookings",
                json={
                    "flight_id": f["id"],
                    "class_key": "business",
                    "seat_labels": [avail["label"]],
                    "passenger_name": "TEST",
                    "passenger_phone": TEST_PHONE,
                },
                timeout=10,
            )
            lbl = avail["label"]
        else:
            lbl = booked[0]["label"]
        r = client.post(
            f"{API}/bookings",
            json={
                "flight_id": f["id"],
                "class_key": "business",
                "seat_labels": [lbl],
                "passenger_name": "TEST Dup",
                "passenger_phone": TEST_PHONE,
            },
            timeout=10,
        )
        assert r.status_code == 409, r.text

    def test_wrong_class_seat_400(self, client, flights):
        # Try booking a business table under class_key=first
        f = flights[3]
        biz_seat = next(s for s in f["seats"] if s["class_key"] == "business")
        r = client.post(
            f"{API}/bookings",
            json={
                "flight_id": f["id"],
                "class_key": "first",
                "seat_labels": [biz_seat["label"]],
                "passenger_name": "TEST",
                "passenger_phone": TEST_PHONE,
            },
            timeout=10,
        )
        assert r.status_code == 400, r.text

    def test_empty_seat_labels_business_400(self, client, flights):
        r = client.post(
            f"{API}/bookings",
            json={
                "flight_id": flights[3]["id"],
                "class_key": "business",
                "seat_labels": [],
                "passenger_name": "TEST",
                "passenger_phone": TEST_PHONE,
            },
            timeout=10,
        )
        assert r.status_code == 400

    def test_empty_seat_labels_first_400(self, client, flights):
        r = client.post(
            f"{API}/bookings",
            json={
                "flight_id": flights[3]["id"],
                "class_key": "first",
                "seat_labels": [],
                "passenger_name": "TEST",
                "passenger_phone": TEST_PHONE,
            },
            timeout=10,
        )
        assert r.status_code == 400

    def test_unknown_seat_400(self, client, flights):
        r = client.post(
            f"{API}/bookings",
            json={
                "flight_id": flights[3]["id"],
                "class_key": "business",
                "seat_labels": ["99"],
                "passenger_name": "TEST",
                "passenger_phone": TEST_PHONE,
            },
            timeout=10,
        )
        assert r.status_code == 400

    def test_invalid_class_400(self, client, flights):
        r = client.post(
            f"{API}/bookings",
            json={
                "flight_id": flights[0]["id"],
                "class_key": "nonsense",
                "quantity": 1,
                "passenger_name": "TEST",
                "passenger_phone": TEST_PHONE,
            },
            timeout=10,
        )
        assert r.status_code == 400

    def test_unknown_flight_404(self, client):
        r = client.post(
            f"{API}/bookings",
            json={
                "flight_id": "no-such-flight-id",
                "class_key": "economy",
                "quantity": 1,
                "passenger_name": "TEST",
                "passenger_phone": TEST_PHONE,
            },
            timeout=10,
        )
        assert r.status_code == 404

    def test_get_bookings_by_phone(self, client):
        r = client.get(f"{API}/bookings", params={"phone": TEST_PHONE}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 3
        for b in data:
            assert b["passenger_phone"] == TEST_PHONE

    def test_get_booking_by_id(self, client):
        bid = TestBookings.created_booking_id
        assert bid
        r = client.get(f"{API}/bookings/{bid}", timeout=10)
        assert r.status_code == 200
        assert r.json()["id"] == bid

    def test_get_booking_unknown_404(self, client):
        r = client.get(f"{API}/bookings/no-such-id", timeout=10)
        assert r.status_code == 404

    def test_get_flight_unknown_404(self, client):
        r = client.get(f"{API}/flights/nope", timeout=10)
        assert r.status_code == 404

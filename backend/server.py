from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import secrets
import logging
import random
import string
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
ADMIN_PIN = os.environ.get('ADMIN_PIN', '000000')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------------- Perks / copy constants ----------------
ECO_TAG = "Free entry — walk in, no table"
BIZ_TAG = "Cocktail table + bottle"
FIRST_TAG = "Private booth + premium bottles"
ECO_PERKS = ["Standing / dancefloor access", "No table or bottle", "Coat check"]
BIZ_PERKS = ["Cocktail table (3–6 pax)", "1 bottle included", "Priority entry", "Dedicated server"]
FIRST_PERKS = ["Private booth (up to 10 pax)", "2 premium bottles included",
               "Skip-the-line VIP entry", "Personal host & mixers", "Best view of the pilot"]


# ---------------- Models ----------------
class SeatClass(BaseModel):
    key: str
    name: str
    tagline: str
    perks: List[str]
    price: int
    unit: str
    capacity: int
    booked: int = 0


class Seat(BaseModel):
    label: str
    name: str
    class_key: str
    x: float
    y: float
    status: str = "available"


class Flight(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    flight_number: str
    destination: str
    tagline: str
    pilot: str
    genres: List[str]
    venue: str
    gate: str
    terminal: str
    departure: str
    duration: str
    image_url: str
    description: str
    classes: List[SeatClass]
    seats: List[Seat] = []
    gallery_url: str = ""


class AdminFlightInput(BaseModel):
    flight_number: Optional[str] = None
    destination: str
    tagline: str = ""
    pilot: str
    genres: List[str] = []
    venue: str = "Stardust, BGC"
    gate: str = "A1"
    terminal: str = "T2"
    departure: str
    duration: str = "6h set"
    image_url: str
    description: str = ""
    gallery_url: str = ""
    economy_price: int = 0
    business_price: int = 2500
    first_price: int = 15000
    economy_capacity: int = 400
    business_tables: int = 12
    first_booths: int = 4


class BookingCreate(BaseModel):
    flight_id: str
    class_key: str
    quantity: int = 1
    seat_labels: List[str] = []
    passenger_name: str
    passenger_phone: str


class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reference: str
    flight_id: str
    flight_number: str
    destination: str
    pilot: str
    venue: str
    gate: str
    terminal: str
    departure: str
    class_key: str
    class_name: str
    unit: str
    quantity: int
    passenger_name: str
    passenger_phone: str
    seat_label: str
    total: int
    status: str = "CONFIRMED"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def gen_reference() -> str:
    return "FA" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


# ---------------- Venue floor plan (Stardust) ----------------
def _venue_seats() -> List[Seat]:
    first = [
        Seat(label="FC1", name="First Class 1", class_key="first", x=0.14, y=0.12),
        Seat(label="FC2", name="First Class 2", class_key="first", x=0.34, y=0.12),
        Seat(label="FC3", name="First Class 3", class_key="first", x=0.54, y=0.12),
        Seat(label="FC4", name="First Class 4", class_key="first", x=0.88, y=0.55),
    ]
    biz_pos = {
        "1": (0.18, 0.61), "2": (0.18, 0.49), "3": (0.18, 0.37), "4": (0.14, 0.25),
        "5": (0.41, 0.32), "6": (0.45, 0.50), "7": (0.42, 0.67), "8": (0.57, 0.68),
        "9": (0.63, 0.50), "10": (0.56, 0.32), "11": (0.76, 0.65), "12": (0.76, 0.40),
    }
    biz = [Seat(label=n, name=f"Table {n}", class_key="business", x=p[0], y=p[1])
           for n, p in biz_pos.items()]
    return first + biz


VENUE_SEATS = _venue_seats()


def build_flight(inp: AdminFlightInput, existing: Optional[dict] = None) -> Flight:
    """Assemble a Flight (classes + seats) from admin input, preserving booked seats on edit."""
    prev_status = {}
    if existing:
        prev_status = {s["label"]: s.get("status", "available") for s in existing.get("seats", [])}

    tables = max(0, min(12, inp.business_tables))
    booths = max(0, min(4, inp.first_booths))

    biz_src = [s for s in VENUE_SEATS if s.class_key == "business"][:tables]
    first_src = [s for s in VENUE_SEATS if s.class_key == "first"][:booths]

    seats: List[Seat] = []
    for s in first_src + biz_src:
        seats.append(Seat(label=s.label, name=s.name, class_key=s.class_key,
                          x=s.x, y=s.y, status=prev_status.get(s.label, "available")))

    biz_booked = sum(1 for s in seats if s.class_key == "business" and s.status == "booked")
    first_booked = sum(1 for s in seats if s.class_key == "first" and s.status == "booked")
    eco_booked = 0
    if existing:
        eco = next((c for c in existing.get("classes", []) if c["key"] == "economy"), None)
        eco_booked = eco.get("booked", 0) if eco else 0

    classes = [
        SeatClass(key="economy", name="Economy", tagline=ECO_TAG, perks=ECO_PERKS,
                  price=max(0, inp.economy_price), unit="seat",
                  capacity=inp.economy_capacity, booked=eco_booked),
        SeatClass(key="business", name="Business Class", tagline=BIZ_TAG, perks=BIZ_PERKS,
                  price=inp.business_price, unit="table", capacity=tables, booked=biz_booked),
        SeatClass(key="first", name="First Class", tagline=FIRST_TAG, perks=FIRST_PERKS,
                  price=inp.first_price, unit="booth", capacity=booths, booked=first_booked),
    ]

    flight_number = (inp.flight_number or "").strip() or f"FA {random.randint(0, 999):03d}"

    return Flight(
        id=existing["id"] if existing else str(uuid.uuid4()),
        flight_number=flight_number,
        destination=inp.destination,
        tagline=inp.tagline,
        pilot=inp.pilot,
        genres=inp.genres,
        venue=inp.venue,
        gate=inp.gate,
        terminal=inp.terminal,
        departure=inp.departure,
        duration=inp.duration,
        image_url=inp.image_url,
        description=inp.description,
        classes=classes,
        seats=seats,
        gallery_url=inp.gallery_url,
    )


# ---------------- Seed ----------------
def _seed_flights() -> List[dict]:
    now = datetime.now(timezone.utc)
    base = dict(economy_price=0, business_price=2500, first_price=15000,
                economy_capacity=400, business_tables=12, first_booths=4, venue="Stardust, BGC")
    inputs = [
        AdminFlightInput(flight_number="FA 808", destination="Tokyo", tagline="Neon nights & future bass",
                         pilot="DJ KAZE", genres=["Future Bass", "J-House", "Tech"], gate="A1", terminal="T2",
                         departure=(now + timedelta(days=3, hours=21)).isoformat(), duration="6h set",
                         image_url="https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
                         description="Board the red-eye to Tokyo. Expect a wall of neon, punchy future bass and a late-night tech house descent as DJ KAZE takes the controls. Destination: pure electric Shibuya energy.",
                         **base),
        AdminFlightInput(flight_number="FA 234", destination="Lagos", tagline="Afrobeats after dark",
                         pilot="DJ AMARA", genres=["Afrobeats", "Amapiano", "Afro-House"], gate="C4", terminal="T1",
                         departure=(now + timedelta(days=6, hours=22)).isoformat(), duration="5h set",
                         image_url="https://images.unsplash.com/photo-1715619684759-8203b89e88ee?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
                         description="A one-way ticket to Lagos. Rolling amapiano log-drums, soaring afrobeats and afro-house grooves. DJ AMARA flies you straight into the heart of West African nightlife.",
                         **base),
        AdminFlightInput(flight_number="FA 511", destination="Berlin", tagline="Industrial techno descent",
                         pilot="DJ VOLT", genres=["Techno", "Minimal", "Industrial"], gate="B2", terminal="T3",
                         departure=(now + timedelta(days=10, hours=23)).isoformat(), duration="8h set",
                         image_url="https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
                         description="Long-haul to Berlin. Concrete, fog and relentless four-on-the-floor techno. DJ VOLT keeps the cabin dark and the BPM high until sunrise.",
                         **base),
        AdminFlightInput(flight_number="FA 072", destination="Rio", tagline="Baile funk & tropical heat",
                         pilot="DJ SOL", genres=["Baile Funk", "Tropical", "House"], gate="A3", terminal="T2",
                         departure=(now + timedelta(days=14, hours=21)).isoformat(), duration="5h set",
                         image_url="https://images.unsplash.com/photo-1483729558449-99ef09a8c325?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
                         description="Sun-soaked flight to Rio. Baile funk bounce, tropical house and carnival heat under the open sky. DJ SOL is your captain for a night that never cools down.",
                         **base),
        AdminFlightInput(flight_number="FA 019", destination="Seoul", tagline="K-house & hyperpop",
                         pilot="DJ MIRO", genres=["K-House", "Hyperpop", "Electro"], gate="B1", terminal="T1",
                         departure=(now - timedelta(days=5)).isoformat(), duration="6h set",
                         image_url="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
                         description="Our sold-out night to Seoul. Glittering K-house, hyperpop chaos and electro energy with DJ MIRO at the controls. Thanks for flying with us — catch the photos below.",
                         gallery_url="https://drive.google.com/drive/folders/foreign-affairs-seoul",
                         **base),
    ]
    return [build_flight(i).dict() for i in inputs]


@app.on_event("startup")
async def startup():
    if await db.flights.count_documents({}) == 0:
        await db.flights.insert_many(_seed_flights())
        logger.info("Seeded flights")


def _clean(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


def verify_admin_pin(x_admin_pin: str = Header(None)):
    if not x_admin_pin or not secrets.compare_digest(str(x_admin_pin), ADMIN_PIN):
        raise HTTPException(status_code=401, detail="Invalid admin PIN")
    return True


# ---------------- Public routes ----------------
@api_router.get("/")
async def root():
    return {"message": "Foreign Affairs API"}


@api_router.get("/flights", response_model=List[Flight])
async def get_flights():
    docs = await db.flights.find().sort("departure", 1).to_list(1000)
    return [Flight(**_clean(d)) for d in docs]


@api_router.get("/flights/{flight_id}", response_model=Flight)
async def get_flight(flight_id: str):
    doc = await db.flights.find_one({"id": flight_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Flight not found")
    return Flight(**_clean(doc))


@api_router.post("/bookings", response_model=Booking)
async def create_booking(payload: BookingCreate):
    doc = await db.flights.find_one({"id": payload.flight_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Flight not found")
    flight = Flight(**_clean(doc))

    if flight.departure < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=400, detail="This flight has already departed")

    seat_class = next((c for c in flight.classes if c.key == payload.class_key), None)
    if not seat_class:
        raise HTTPException(status_code=400, detail="Invalid class")

    if payload.class_key == "economy":
        if payload.quantity < 1:
            raise HTTPException(status_code=400, detail="Quantity must be at least 1")
        quantity = payload.quantity
        seat_label = "WALK-IN"
        total = 0
    else:
        labels = payload.seat_labels
        if not labels:
            raise HTTPException(status_code=400, detail="Please select at least one table/booth")
        seat_map = {s.label: s for s in flight.seats}
        for lbl in labels:
            seat = seat_map.get(lbl)
            if not seat:
                raise HTTPException(status_code=400, detail=f"Unknown seat {lbl}")
            if seat.class_key != payload.class_key:
                raise HTTPException(status_code=400, detail=f"{seat.name} is not in {seat_class.name}")
            if seat.status == "booked":
                raise HTTPException(status_code=409, detail=f"{seat.name} is already booked")
        for lbl in labels:
            await db.flights.update_one(
                {"id": flight.id, "seats.label": lbl},
                {"$set": {"seats.$.status": "booked"}},
            )
        quantity = len(labels)
        seat_label = ", ".join(seat_map[lbl].name for lbl in labels)
        total = seat_class.price * quantity

    booking = Booking(
        reference=gen_reference(), flight_id=flight.id, flight_number=flight.flight_number,
        destination=flight.destination, pilot=flight.pilot, venue=flight.venue, gate=flight.gate,
        terminal=flight.terminal, departure=flight.departure, class_key=seat_class.key,
        class_name=seat_class.name, unit=seat_class.unit, quantity=quantity,
        passenger_name=payload.passenger_name, passenger_phone=payload.passenger_phone,
        seat_label=seat_label, total=total,
    )
    await db.flights.update_one(
        {"id": flight.id, "classes.key": seat_class.key},
        {"$inc": {"classes.$.booked": quantity}},
    )
    await db.bookings.insert_one(booking.dict())
    return booking


@api_router.get("/bookings", response_model=List[Booking])
async def get_bookings(phone: str):
    docs = await db.bookings.find({"passenger_phone": phone}).sort("created_at", -1).to_list(1000)
    return [Booking(**_clean(d)) for d in docs]


@api_router.get("/bookings/{booking_id}", response_model=Booking)
async def get_booking(booking_id: str):
    doc = await db.bookings.find_one({"id": booking_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    return Booking(**_clean(doc))


# ---------------- Admin routes ----------------
@api_router.post("/admin/verify-pin")
async def verify_pin(body: dict):
    pin = str(body.get("pin", ""))
    return {"valid": bool(pin) and secrets.compare_digest(pin, ADMIN_PIN)}


@api_router.get("/admin/flights", response_model=List[Flight], dependencies=[Depends(verify_admin_pin)])
async def admin_get_flights():
    docs = await db.flights.find().sort("departure", 1).to_list(1000)
    return [Flight(**_clean(d)) for d in docs]


@api_router.post("/admin/flights", response_model=Flight, dependencies=[Depends(verify_admin_pin)])
async def admin_create_flight(inp: AdminFlightInput):
    flight = build_flight(inp)
    await db.flights.insert_one(flight.dict())
    return flight


@api_router.put("/admin/flights/{flight_id}", response_model=Flight, dependencies=[Depends(verify_admin_pin)])
async def admin_update_flight(flight_id: str, inp: AdminFlightInput):
    existing = await db.flights.find_one({"id": flight_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Flight not found")
    flight = build_flight(inp, existing=_clean(existing))
    await db.flights.replace_one({"id": flight_id}, flight.dict())
    return flight


@api_router.delete("/admin/flights/{flight_id}", dependencies=[Depends(verify_admin_pin)])
async def admin_delete_flight(flight_id: str):
    res = await db.flights.delete_one({"id": flight_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Flight not found")
    return {"ok": True}


@api_router.post("/admin/flights/{flight_id}/reset-seats", response_model=Flight, dependencies=[Depends(verify_admin_pin)])
async def admin_reset_seats(flight_id: str):
    existing = await db.flights.find_one({"id": flight_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Flight not found")
    flight = Flight(**_clean(existing))
    for s in flight.seats:
        s.status = "available"
    for c in flight.classes:
        c.booked = 0
    await db.flights.replace_one({"id": flight_id}, flight.dict())
    return flight


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

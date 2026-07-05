from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import string
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ---------------- Models ----------------
class SeatClass(BaseModel):
    key: str                # economy | business | first
    name: str
    tagline: str
    perks: List[str]
    price: int              # PHP
    unit: str               # "seat" | "table" | "booth"
    capacity: int
    booked: int = 0


class Seat(BaseModel):
    label: str              # short label used on boarding pass e.g. "1", "FC1"
    name: str               # display name e.g. "Table 1", "First Class 1"
    class_key: str          # business | first
    x: float                # normalized 0..1 center X on floor plan
    y: float                # normalized 0..1 center Y on floor plan
    status: str = "available"  # available | booked


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


class BookingCreate(BaseModel):
    flight_id: str
    class_key: str
    quantity: int = 1                 # used for Economy (walk-in)
    seat_labels: List[str] = []       # used for Business / First (specific tables/booths)
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
# Normalized 0..1 positions matching the club layout.
def _venue_seats() -> List[Seat]:
    first = [
        Seat(label="FC1", name="First Class 1", class_key="first", x=0.14, y=0.12),
        Seat(label="FC2", name="First Class 2", class_key="first", x=0.34, y=0.12),
        Seat(label="FC3", name="First Class 3", class_key="first", x=0.54, y=0.12),
        Seat(label="FC4", name="First Class 4", class_key="first", x=0.88, y=0.55),
    ]
    biz_pos = {
        "1": (0.18, 0.61), "2": (0.18, 0.49), "3": (0.18, 0.37), "4": (0.08, 0.27),
        "5": (0.41, 0.32), "6": (0.45, 0.50), "7": (0.42, 0.67), "8": (0.57, 0.68),
        "9": (0.63, 0.50), "10": (0.56, 0.32), "11": (0.76, 0.65), "12": (0.76, 0.40),
    }
    biz = [
        Seat(label=n, name=f"Table {n}", class_key="business", x=p[0], y=p[1])
        for n, p in biz_pos.items()
    ]
    return first + biz


# ---------------- Seed ----------------
def _seed_flights() -> List[dict]:
    now = datetime.now(timezone.utc)

    def eco():
        return SeatClass(key="economy", name="Economy", tagline="Free entry — walk in, no table",
                         perks=["Standing / dancefloor access", "No table or bottle", "Coat check"],
                         price=0, unit="seat", capacity=400)

    def biz():
        return SeatClass(key="business", name="Business Class", tagline="Cocktail table + bottle",
                         perks=["Cocktail table (3–6 pax)", "1 bottle included", "Priority entry", "Dedicated server"],
                         price=2500, unit="table", capacity=12)

    def first():
        return SeatClass(key="first", name="First Class", tagline="Private booth + premium bottles",
                         perks=["Private booth (up to 10 pax)", "2 premium bottles included", "Skip-the-line VIP entry", "Personal host & mixers", "Best view of the pilot"],
                         price=15000, unit="booth", capacity=4)

    def mk(**kw):
        return Flight(classes=[eco(), biz(), first()], seats=_venue_seats(), **kw)

    flights = [
        mk(flight_number="FA 808", destination="Tokyo", tagline="Neon nights & future bass",
           pilot="DJ KAZE", genres=["Future Bass", "J-House", "Tech"], venue="Stardust, BGC",
           gate="A1", terminal="T2", departure=(now + timedelta(days=3, hours=21)).isoformat(),
           duration="6h set",
           image_url="https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
           description="Board the red-eye to Tokyo. Expect a wall of neon, punchy future bass and a late-night tech house descent as DJ KAZE takes the controls. Destination: pure electric Shibuya energy."),
        mk(flight_number="FA 234", destination="Lagos", tagline="Afrobeats after dark",
           pilot="DJ AMARA", genres=["Afrobeats", "Amapiano", "Afro-House"], venue="Stardust, BGC",
           gate="C4", terminal="T1", departure=(now + timedelta(days=6, hours=22)).isoformat(),
           duration="5h set",
           image_url="https://images.unsplash.com/photo-1715619684759-8203b89e88ee?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
           description="A one-way ticket to Lagos. Rolling amapiano log-drums, soaring afrobeats and afro-house grooves. DJ AMARA flies you straight into the heart of West African nightlife."),
        mk(flight_number="FA 511", destination="Berlin", tagline="Industrial techno descent",
           pilot="DJ VOLT", genres=["Techno", "Minimal", "Industrial"], venue="Stardust, BGC",
           gate="B2", terminal="T3", departure=(now + timedelta(days=10, hours=23)).isoformat(),
           duration="8h set",
           image_url="https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
           description="Long-haul to Berlin. Concrete, fog and relentless four-on-the-floor techno. DJ VOLT keeps the cabin dark and the BPM high until sunrise."),
        mk(flight_number="FA 072", destination="Rio", tagline="Baile funk & tropical heat",
           pilot="DJ SOL", genres=["Baile Funk", "Tropical", "House"], venue="Stardust, BGC",
           gate="A3", terminal="T2", departure=(now + timedelta(days=14, hours=21)).isoformat(),
           duration="5h set",
           image_url="https://images.unsplash.com/photo-1483729558449-99ef09a8c325?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
           description="Sun-soaked flight to Rio. Baile funk bounce, tropical house and carnival heat under the open sky. DJ SOL is your captain for a night that never cools down."),
    ]
    return [f.dict() for f in flights]


@app.on_event("startup")
async def startup():
    count = await db.flights.count_documents({})
    if count == 0:
        await db.flights.insert_many(_seed_flights())
        logger.info("Seeded flights")


def _clean(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


# ---------------- Routes ----------------
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

        # mark seats booked
        for lbl in labels:
            await db.flights.update_one(
                {"id": flight.id, "seats.label": lbl},
                {"$set": {"seats.$.status": "booked"}},
            )
        quantity = len(labels)
        seat_label = ", ".join(seat_map[lbl].name for lbl in labels)
        total = seat_class.price * quantity

    booking = Booking(
        reference=gen_reference(),
        flight_id=flight.id,
        flight_number=flight.flight_number,
        destination=flight.destination,
        pilot=flight.pilot,
        venue=flight.venue,
        gate=flight.gate,
        terminal=flight.terminal,
        departure=flight.departure,
        class_key=seat_class.key,
        class_name=seat_class.name,
        unit=seat_class.unit,
        quantity=quantity,
        passenger_name=payload.passenger_name,
        passenger_phone=payload.passenger_phone,
        seat_label=seat_label,
        total=total,
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

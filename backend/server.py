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
    unit: str               # "seat" or "table"
    capacity: int
    booked: int = 0


class Flight(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    flight_number: str
    destination: str
    tagline: str
    pilot: str              # DJ name
    genres: List[str]
    venue: str
    gate: str
    terminal: str
    departure: str          # ISO datetime string
    duration: str
    image_url: str
    description: str
    classes: List[SeatClass]


class BookingCreate(BaseModel):
    flight_id: str
    class_key: str
    quantity: int = 1
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


# ---------------- Seed ----------------
def _seed_flights() -> List[dict]:
    now = datetime.now(timezone.utc)

    def eco(cap):
        return SeatClass(key="economy", name="Economy", tagline="General admission entry",
                         perks=["Dancefloor access", "Welcome shot on arrival", "Coat check"],
                         price=800, unit="seat", capacity=cap)

    def biz(cap):
        return SeatClass(key="business", name="Business Class", tagline="Cocktail table + bottle",
                         perks=["Reserved cocktail table (4 pax)", "1 house bottle included", "Priority entry", "Dedicated server"],
                         price=6500, unit="table", capacity=cap)

    def first(cap):
        return SeatClass(key="first", name="First Class", tagline="Premium booth + premium bottle",
                         perks=["Premium booth (8 pax)", "2 premium bottles included", "Skip-the-line VIP entry", "Personal host & mixers", "Best view of the pilot"],
                         price=15000, unit="table", capacity=cap)

    flights = [
        Flight(
            flight_number="FA 808",
            destination="Tokyo",
            tagline="Neon nights & future bass",
            pilot="DJ KAZE",
            genres=["Future Bass", "J-House", "Tech"],
            venue="Skydeck, BGC",
            gate="A1", terminal="T2",
            departure=(now + timedelta(days=3, hours=21)).isoformat(),
            duration="6h set",
            image_url="https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
            description="Board the red-eye to Tokyo. Expect a wall of neon, punchy future bass and a late-night tech house descent as DJ KAZE takes the controls. Destination: pure electric Shibuya energy.",
            classes=[eco(120), biz(10), first(4)],
        ),
        Flight(
            flight_number="FA 234",
            destination="Lagos",
            tagline="Afrobeats after dark",
            pilot="DJ AMARA",
            genres=["Afrobeats", "Amapiano", "Afro-House"],
            venue="The Hangar, Poblacion",
            gate="C4", terminal="T1",
            departure=(now + timedelta(days=6, hours=22)).isoformat(),
            duration="5h set",
            image_url="https://images.unsplash.com/photo-1715619684759-8203b89e88ee?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
            description="A one-way ticket to Lagos. Rolling amapiano log-drums, soaring afrobeats and afro-house grooves. DJ AMARA flies you straight into the heart of West African nightlife.",
            classes=[eco(150), biz(12), first(5)],
        ),
        Flight(
            flight_number="FA 511",
            destination="Berlin",
            tagline="Industrial techno descent",
            pilot="DJ VOLT",
            genres=["Techno", "Minimal", "Industrial"],
            venue="Bunker, Makati",
            gate="B2", terminal="T3",
            departure=(now + timedelta(days=10, hours=23)).isoformat(),
            duration="8h set",
            image_url="https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
            description="Long-haul to Berlin. Concrete, fog and relentless four-on-the-floor techno. DJ VOLT keeps the cabin dark and the BPM high until sunrise.",
            classes=[eco(200), biz(8), first(3)],
        ),
        Flight(
            flight_number="FA 072",
            destination="Rio",
            tagline="Baile funk & tropical heat",
            pilot="DJ SOL",
            genres=["Baile Funk", "Tropical", "House"],
            venue="Rooftop 88, Cebu",
            gate="A3", terminal="T2",
            departure=(now + timedelta(days=14, hours=21)).isoformat(),
            duration="5h set",
            image_url="https://images.unsplash.com/photo-1483729558449-99ef09a8c325?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
            description="Sun-soaked flight to Rio. Baile funk bounce, tropical house and carnival heat under the open sky. DJ SOL is your captain for a night that never cools down.",
            classes=[eco(140), biz(10), first(4)],
        ),
    ]
    return [f.dict() for f in flights]


@app.on_event("startup")
async def startup():
    count = await db.flights.count_documents({})
    if count == 0:
        await db.flights.insert_many(_seed_flights())
        logger.info("Seeded flights")


# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"message": "Foreign Affairs API"}


@api_router.get("/flights", response_model=List[Flight])
async def get_flights():
    docs = await db.flights.find().sort("departure", 1).to_list(1000)
    return [Flight(**{k: v for k, v in d.items() if k != "_id"}) for d in docs]


@api_router.get("/flights/{flight_id}", response_model=Flight)
async def get_flight(flight_id: str):
    doc = await db.flights.find_one({"id": flight_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Flight not found")
    return Flight(**{k: v for k, v in doc.items() if k != "_id"})


@api_router.post("/bookings", response_model=Booking)
async def create_booking(payload: BookingCreate):
    doc = await db.flights.find_one({"id": payload.flight_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Flight not found")
    flight = Flight(**{k: v for k, v in doc.items() if k != "_id"})

    seat_class = next((c for c in flight.classes if c.key == payload.class_key), None)
    if not seat_class:
        raise HTTPException(status_code=400, detail="Invalid class")

    if payload.quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")

    if seat_class.booked + payload.quantity > seat_class.capacity:
        raise HTTPException(status_code=409, detail=f"Only {seat_class.capacity - seat_class.booked} {seat_class.unit}(s) left in {seat_class.name}")

    # seat / table label
    start = seat_class.booked + 1
    prefix = {"economy": "S", "business": "T", "first": "V"}[payload.class_key]
    if payload.quantity == 1:
        seat_label = f"{prefix}{start:02d}"
    else:
        seat_label = f"{prefix}{start:02d}-{prefix}{start + payload.quantity - 1:02d}"

    total = seat_class.price * payload.quantity

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
        quantity=payload.quantity,
        passenger_name=payload.passenger_name,
        passenger_phone=payload.passenger_phone,
        seat_label=seat_label,
        total=total,
    )

    # decrement availability (mock payment always succeeds)
    await db.flights.update_one(
        {"id": flight.id, "classes.key": seat_class.key},
        {"$inc": {"classes.$.booked": payload.quantity}},
    )
    await db.bookings.insert_one(booking.dict())
    return booking


@api_router.get("/bookings", response_model=List[Booking])
async def get_bookings(phone: str):
    docs = await db.bookings.find({"passenger_phone": phone}).sort("created_at", -1).to_list(1000)
    return [Booking(**{k: v for k, v in d.items() if k != "_id"}) for d in docs]


@api_router.get("/bookings/{booking_id}", response_model=Booking)
async def get_booking(booking_id: str):
    doc = await db.bookings.find_one({"id": booking_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    return Booking(**{k: v for k, v in doc.items() if k != "_id"})


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

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL + "/api";

export type SeatClass = {
  key: string;
  name: string;
  tagline: string;
  perks: string[];
  price: number;
  unit: string;
  capacity: number;
  booked: number;
};

export type Flight = {
  id: string;
  flight_number: string;
  destination: string;
  tagline: string;
  pilot: string;
  genres: string[];
  venue: string;
  gate: string;
  terminal: string;
  departure: string;
  duration: string;
  image_url: string;
  description: string;
  classes: SeatClass[];
};

export type Booking = {
  id: string;
  reference: string;
  flight_id: string;
  flight_number: string;
  destination: string;
  pilot: string;
  venue: string;
  gate: string;
  terminal: string;
  departure: string;
  class_key: string;
  class_name: string;
  unit: string;
  quantity: number;
  passenger_name: string;
  passenger_phone: string;
  seat_label: string;
  total: number;
  status: string;
  created_at: string;
};

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let detail = "Request failed";
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  getFlights: () => req<Flight[]>("/flights"),
  getFlight: (id: string) => req<Flight>(`/flights/${id}`),
  getBooking: (id: string) => req<Booking>(`/bookings/${id}`),
  getBookings: (phone: string) =>
    req<Booking[]>(`/bookings?phone=${encodeURIComponent(phone)}`),
  createBooking: (payload: {
    flight_id: string;
    class_key: string;
    quantity: number;
    passenger_name: string;
    passenger_phone: string;
  }) =>
    req<Booking>("/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export function formatDeparture(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { date: date.toUpperCase(), time };
}

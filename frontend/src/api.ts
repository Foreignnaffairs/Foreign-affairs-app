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

export type Seat = {
  label: string;
  name: string;
  class_key: string;
  x: number;
  y: number;
  status: string;
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
  seats: Seat[];
  gallery_url: string;
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
    quantity?: number;
    seat_labels?: string[];
    passenger_name: string;
    passenger_phone: string;
  }) =>
    req<Booking>("/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export type AdminFlightInput = {
  flight_number?: string;
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
  gallery_url: string;
  economy_price: number;
  business_price: number;
  first_price: number;
  economy_capacity: number;
  business_tables: number;
  first_booths: number;
};

function adminHeaders(pin: string) {
  return { "Content-Type": "application/json", "X-Admin-PIN": pin };
}

export const adminApi = {
  verifyPin: (pin: string) =>
    req<{ valid: boolean }>("/admin/verify-pin", {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),
  listFlights: (pin: string) =>
    req<Flight[]>("/admin/flights", { headers: adminHeaders(pin) }),
  createFlight: (pin: string, body: AdminFlightInput) =>
    req<Flight>("/admin/flights", {
      method: "POST",
      headers: adminHeaders(pin),
      body: JSON.stringify(body),
    }),
  updateFlight: (pin: string, id: string, body: AdminFlightInput) =>
    req<Flight>(`/admin/flights/${id}`, {
      method: "PUT",
      headers: adminHeaders(pin),
      body: JSON.stringify(body),
    }),
  deleteFlight: (pin: string, id: string) =>
    req<{ ok: boolean }>(`/admin/flights/${id}`, {
      method: "DELETE",
      headers: adminHeaders(pin),
    }),
  resetSeats: (pin: string, id: string) =>
    req<Flight>(`/admin/flights/${id}/reset-seats`, {
      method: "POST",
      headers: adminHeaders(pin),
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

export function isPast(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

import { useSyncExternalStore } from "react";
import { storage } from "@/src/utils/storage";

// Holds the verified admin PIN. null = locked (Admin tab hidden).
let pin: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function init() {
  const saved = await storage.secureGet<string>("fa_admin_pin", "");
  if (saved) {
    pin = saved;
    emit();
  }
}
init();

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getPin(): string | null {
  return pin;
}

export async function unlock(p: string) {
  pin = p;
  await storage.secureSet("fa_admin_pin", p);
  emit();
}

export async function lock() {
  pin = null;
  await storage.secureRemove("fa_admin_pin");
  emit();
}

export function useAdminPin(): string | null {
  return useSyncExternalStore(subscribe, getPin, getPin);
}

import { randomInt } from "node:crypto";

export function createPairCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function isValidCode(code) {
  return /^\d{6}$/.test(String(code));
}

export function makeSession(code, now = Date.now()) {
  return { code, tv: null, phone: null, createdAt: now, expiresAt: now + 5 * 60_000 };
}

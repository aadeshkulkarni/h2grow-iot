import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "h2grow_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

type Gate = { failures: number; lockedUntil: number };

const gate: Gate = ((globalThis as typeof globalThis & { __h2growGate?: Gate })
  .__h2growGate ??= { failures: 0, lockedUntil: 0 });

function secret() {
  return process.env.SESSION_SECRET || "h2grow-dev-session-secret";
}

function expectedPin() {
  const value = process.env.DEVICE_PIN || "7777";
  return /^\d{4}$/.test(value) ? value : "7777";
}

export function pinMatches(input: unknown) {
  if (typeof input !== "string" || !/^\d{4}$/.test(input)) return false;
  const expected = expectedPin();
  return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}

export function pinLockout() {
  const wait = gate.lockedUntil - Date.now();
  return wait > 0 ? wait : 0;
}

export function notePinFailure() {
  gate.failures += 1;
  if (gate.failures >= 5) {
    gate.lockedUntil = Date.now() + 30_000;
    gate.failures = 0;
  }
}

export function notePinSuccess() {
  gate.failures = 0;
  gate.lockedUntil = 0;
}

export function createSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + SESSION_TTL_SECONDS * 1000 }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export async function isAuthenticated() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;

  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      exp?: number;
    };
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export async function writeSession() {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

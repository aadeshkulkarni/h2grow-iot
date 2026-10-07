import type { DeviceStatus } from "@/lib/types";

type EspPayload = {
  temperature: number | null;
  humidity: number | null;
  relay: boolean;
  valid?: boolean;
};

type MockState = { relay: boolean };

function mockState() {
  const store = globalThis as typeof globalThis & { __h2growMock?: MockState };
  store.__h2growMock ??= { relay: false };
  return store.__h2growMock;
}

export function previewMode() {
  return (process.env.ESP32_MODE || "live") !== "live";
}

export function host() {
  return (process.env.ESP32_HOST || "http://h2grow.local").replace(/\/$/, "");
}

export function deviceHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    "X-Device-Key": process.env.DEVICE_KEY || "h2grow-local",
  };
}

function offline(message: string, relay = false): DeviceStatus {
  console.error(`[h2grow] ${message}`);
  return {
    temperature: null,
    humidity: null,
    relay,
    valid: false,
    online: false,
    mode: "live",
    updatedAt: new Date().toISOString(),
    message,
  };
}

function normalize(data: EspPayload, online: boolean): DeviceStatus {
  const temperature =
    typeof data.temperature === "number" && Number.isFinite(data.temperature)
      ? data.temperature
      : null;
  const humidity =
    typeof data.humidity === "number" && Number.isFinite(data.humidity)
      ? data.humidity
      : null;
  const valid = data.valid !== false && temperature !== null;

  return {
    temperature: valid ? temperature : null,
    humidity: valid ? humidity : null,
    relay: Boolean(data.relay),
    valid,
    online,
    mode: "live",
    updatedAt: new Date().toISOString(),
    message: valid ? undefined : "The DHT11 has not returned a reading yet.",
  };
}

function previewReading(): DeviceStatus {
  const wave = Math.sin(Date.now() / 50_000);
  return {
    temperature: Math.round((24.4 + wave * 0.4) * 10) / 10,
    humidity: Math.round(58 + Math.cos(Date.now() / 70_000) * 3),
    relay: mockState().relay,
    valid: true,
    online: true,
    mode: "preview",
    updatedAt: new Date().toISOString(),
  };
}

async function readEsp(path: string, init?: RequestInit) {
  const response = await fetch(`${host()}${path}`, {
    ...init,
    headers: {
      ...deviceHeaders(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) {
    throw new Error(`Board responded with ${response.status}`);
  }
  return (await response.json()) as EspPayload;
}

export async function readDevice(): Promise<DeviceStatus> {
  if (previewMode()) return previewReading();

  try {
    return normalize(await readEsp("/status"), true);
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith("Board responded")
        ? error.message
        : "The ESP32 is unreachable. Check power, Wi-Fi, and ESP32_HOST.";
    return offline(message);
  }
}

export async function setRelay(on: boolean): Promise<DeviceStatus> {
  if (previewMode()) {
    mockState().relay = on;
    return previewReading();
  }

  try {
    const data = await readEsp(`/relay?on=${on ? "1" : "0"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on }),
    });
    return normalize(data, true);
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith("Board responded")
        ? error.message
        : "The switch did not reach the board.";
    return offline(message);
  }
}

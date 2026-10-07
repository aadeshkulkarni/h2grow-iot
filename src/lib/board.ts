import { updateDeviceKey } from "@/lib/env-file";
import { host, deviceHeaders, previewMode } from "@/lib/device";
import { listSerialPorts, pushConfigOverUsb } from "@/lib/serial";

export type BoardSetupInfo = {
  ssid: string;
  deviceKey: string;
  passwordSet: boolean;
  online: boolean;
  ports: string[];
  mode: "live" | "preview";
};

export type BoardSettings = {
  ssid: string;
  password: string;
  key: string;
  port?: string;
};

const keyPattern = /^[A-Za-z0-9._-]{4,64}$/;

export function validateSettings(input: BoardSettings) {
  const ssid = input.ssid.trim();
  const password = input.password;
  const key = input.key.trim();
  if (ssid.length === 0 || ssid.length > 32) return "Enter the Wi-Fi name.";
  if (password.length > 63) return "Wi-Fi passwords can be at most 63 characters.";
  if (!keyPattern.test(key)) return "The device key needs 4 to 64 letters, numbers, dots, or dashes.";
  return null;
}

export async function readBoardSetup(): Promise<BoardSetupInfo> {
  const ports = await listSerialPorts();
  const fallback: BoardSetupInfo = {
    ssid: "",
    deviceKey: process.env.DEVICE_KEY || "h2grow-local",
    passwordSet: false,
    online: false,
    ports,
    mode: previewMode() ? "preview" : "live",
  };
  if (previewMode()) return fallback;

  try {
    const response = await fetch(`${host()}/config`, {
      headers: deviceHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return fallback;
    const data = (await response.json()) as {
      ssid?: string;
      key?: string;
      passwordSet?: boolean;
    };
    const ssid = data.ssid && data.ssid !== "YOUR_WIFI_NAME" ? data.ssid : "";
    return {
      ssid,
      deviceKey: data.key || fallback.deviceKey,
      passwordSet: Boolean(data.passwordSet),
      online: true,
      ports,
      mode: "live",
    };
  } catch {
    return fallback;
  }
}

async function pushOverWifi(settings: BoardSettings) {
  const body = new URLSearchParams({
    ssid: settings.ssid.trim(),
    password: settings.password,
    key: settings.key.trim(),
  });
  const response = await fetch(`${host()}/config`, {
    method: "POST",
    headers: {
      ...deviceHeaders(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`Board responded with ${response.status}`);
}

export async function applyBoardSettings(settings: BoardSettings) {
  const problem = validateSettings(settings);
  if (problem) return { ok: false as const, error: problem };

  const saved = {
    ssid: settings.ssid.trim(),
    password: settings.password,
    key: settings.key.trim(),
  };

  if (!previewMode()) {
    try {
      await pushOverWifi(saved);
      await updateDeviceKey(saved.key);
      return {
        ok: true as const,
        via: "wifi" as const,
        message: "Settings saved. The board is restarting and joining that Wi-Fi.",
      };
    } catch (error) {
      const refused =
        error instanceof Error && error.message.startsWith("Board responded");
      if (refused) {
        return { ok: false as const, error: "The board refused the settings. Check the device key." };
      }
    }
  }

  const ports = await listSerialPorts();
  const port = settings.port && ports.includes(settings.port) ? settings.port : ports[0];
  if (!port) {
    return {
      ok: false as const,
      error: "Plug the ESP32 into this Mac with a data cable, then try again. Close the Arduino Serial Monitor first.",
    };
  }

  try {
    console.log(`[h2grow] sending settings over USB on ${port}`);
    await pushConfigOverUsb(port, saved);
    await updateDeviceKey(saved.key);
    return {
      ok: true as const,
      via: "usb" as const,
      message: "Settings saved over USB. The board is restarting and joining that Wi-Fi.",
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "The settings did not reach the board.",
    };
  }
}

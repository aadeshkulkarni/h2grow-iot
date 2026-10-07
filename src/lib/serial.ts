import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { open, readdir, type FileHandle } from "node:fs/promises";

export async function listSerialPorts() {
  let names: string[] = [];
  try {
    names = await readdir("/dev");
  } catch {
    return [];
  }
  return names
    .filter((name) => /^cu\.(usb|wchusbserial|SLAB)/.test(name))
    .map((name) => `/dev/${name}`)
    .sort();
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile(command, args, (error) => (error ? reject(error) : resolve()));
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readAvailable(handle: FileHandle, into: Buffer) {
  try {
    const { bytesRead } = await handle.read(into, 0, into.length, null);
    return bytesRead;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EAGAIN" || code === "EWOULDBLOCK") return 0;
    throw error;
  }
}

async function waitFor(handle: FileHandle, chunk: Buffer, pattern: RegExp, timeoutMs: number) {
  const started = Date.now();
  let buffer = "";
  while (Date.now() - started < timeoutMs) {
    const bytes = await readAvailable(handle, chunk);
    if (bytes > 0) {
      buffer += chunk.subarray(0, bytes).toString("utf8");
      if (buffer.length > 6000) buffer = buffer.slice(-3000);
      if (pattern.test(buffer)) return buffer;
    } else {
      await sleep(40);
    }
  }
  return buffer;
}

async function writeAll(handle: FileHandle, text: string) {
  const payload = Buffer.from(text);
  let offset = 0;
  while (offset < payload.length) {
    const { bytesWritten } = await handle.write(payload.subarray(offset));
    if (bytesWritten === 0) await sleep(20);
    else offset += bytesWritten;
  }
}

export async function pushConfigOverUsb(
  port: string,
  config: { ssid: string; password: string; key: string },
) {
  try {
    await run("stty", ["-f", port, "115200", "cs8", "-cstopb", "-parenb", "raw", "-echo"]);
  } catch {
    throw new Error("The USB port is busy. Close the Arduino Serial Monitor and try again.");
  }

  let handle: FileHandle;
  try {
    handle = await open(port, constants.O_RDWR | constants.O_NONBLOCK);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EBUSY" || code === "EACCES") {
      throw new Error("The USB port is busy. Close the Arduino Serial Monitor and try again.");
    }
    throw new Error("The ESP32 USB port could not be opened.");
  }

  const chunk = Buffer.alloc(512);
  try {
    const early = await waitFor(handle, chunk, /relay=|HTTP server is ready/, 2500);
    const alreadyRunning = /relay=|HTTP server is ready/.test(early);
    if (!alreadyRunning) {
      const booted = await waitFor(handle, chunk, /HTTP server is ready|relay=/, 22000);
      if (!/HTTP server is ready|relay=/.test(booted)) {
        throw new Error(
          "The board did not finish starting. Upload the H2GROW sketch once from Arduino IDE, then try again.",
        );
      }
    }

    const line = `CFG ${JSON.stringify({
      ssid: config.ssid,
      password: config.password,
      key: config.key,
    })}\n`;
    await writeAll(handle, line);

    const reply = await waitFor(handle, chunk, /CFG_OK|CFG_ERR/, 8000);
    if (reply.includes("CFG_ERR")) throw new Error("The board rejected the settings.");
    if (!reply.includes("CFG_OK")) {
      throw new Error(
        "The board did not confirm the settings. Upload the H2GROW sketch once from Arduino IDE, then try again.",
      );
    }
  } finally {
    await handle.close();
  }
}

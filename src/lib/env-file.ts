import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function updateDeviceKey(key: string) {
  if ((process.env.DEVICE_KEY || "h2grow-local") === key) {
    process.env.DEVICE_KEY = key;
    return;
  }

  const file = path.join(process.cwd(), ".env.local");
  let text = "";
  try {
    text = await readFile(file, "utf8");
  } catch {
    text = "";
  }

  const line = `DEVICE_KEY=${key}`;
  text = /^DEVICE_KEY=/m.test(text)
    ? text.replace(/^DEVICE_KEY=.*$/m, line)
    : `${text.trimEnd()}\n${line}\n`;

  await writeFile(file, text.endsWith("\n") ? text : `${text}\n`);
  process.env.DEVICE_KEY = key;
}

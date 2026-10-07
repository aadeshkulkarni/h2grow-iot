import {
  notePinFailure,
  notePinSuccess,
  pinLockout,
  pinMatches,
  writeSession,
} from "@/lib/session";

export async function POST(request: Request) {
  const wait = pinLockout();
  if (wait > 0) {
    return Response.json(
      { error: "Too many attempts. Wait a moment." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = (await request.json().catch(() => null)) as { pin?: unknown } | null;
  if (!pinMatches(body?.pin)) {
    notePinFailure();
    return Response.json(
      { error: "Incorrect PIN" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  notePinSuccess();
  await writeSession();
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}

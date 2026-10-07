import { setRelay } from "@/lib/device";
import { isAuthenticated } from "@/lib/session";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json(
      { error: "Locked" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = (await request.json().catch(() => null)) as { on?: unknown } | null;
  if (!body || typeof body.on !== "boolean") {
    return Response.json(
      { error: "Expected on to be true or false." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(await setRelay(body.on), {
    headers: { "Cache-Control": "no-store" },
  });
}

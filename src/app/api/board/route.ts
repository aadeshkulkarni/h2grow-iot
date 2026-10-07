import { applyBoardSettings, readBoardSetup, type BoardSettings } from "@/lib/board";
import { isAuthenticated } from "@/lib/session";

function locked() {
  return Response.json(
    { error: "Locked" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  if (!(await isAuthenticated())) return locked();
  return Response.json(await readBoardSetup(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return locked();

  const body = (await request.json().catch(() => null)) as Partial<BoardSettings> | null;
  const result = await applyBoardSettings({
    ssid: typeof body?.ssid === "string" ? body.ssid : "",
    password: typeof body?.password === "string" ? body.password : "",
    key: typeof body?.key === "string" ? body.key : "",
    port: typeof body?.port === "string" ? body.port : undefined,
  });

  return Response.json(result, {
    status: result.ok ? 200 : 400,
    headers: { "Cache-Control": "no-store" },
  });
}

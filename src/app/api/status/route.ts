import { readDevice } from "@/lib/device";
import { isAuthenticated } from "@/lib/session";

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json(
      { error: "Locked" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(await readDevice(), {
    headers: { "Cache-Control": "no-store" },
  });
}

import { NextRequest } from "next/server";
import { handleBrokerSync } from "@/lib/sync/route-helper";

export const dynamic = "force-dynamic";

// Fidelity is CSV-import only; the engine reports a skipped (but ok) result.
export async function POST(req: NextRequest) {
  return handleBrokerSync(req, "fidelity");
}

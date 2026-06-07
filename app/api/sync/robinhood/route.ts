import { NextRequest } from "next/server";
import { handleBrokerSync } from "@/lib/sync/route-helper";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handleBrokerSync(req, "robinhood");
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllBrokerAvailability } from "@/lib/brokers/availability";

export const dynamic = "force-dynamic";

/** Returns each broker's real availability on this deployment (auth required). */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ brokers: getAllBrokerAvailability() });
}

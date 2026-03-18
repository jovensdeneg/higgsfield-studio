/**
 * POST /api/cleanup/stale
 *
 * Finds assets stuck in "generating" status for more than STALE_MINUTES
 * and marks them as "failed" so the user can retry.
 * Also marks corresponding generation_jobs as failed.
 *
 * Called automatically by the frontend's auto-poll cycle.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const STALE_MINUTES = 5;

export async function POST() {
  try {
    const supabase = createServerClient();

    const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

    // Find assets stuck in "generating" older than cutoff
    const { data: staleAssets, error: queryError } = await supabase
      .from("assets")
      .select("id")
      .eq("status", "generating")
      .lt("updated_at", cutoff);

    if (queryError || !staleAssets || staleAssets.length === 0) {
      return NextResponse.json({ cleaned: 0 });
    }

    const staleIds = staleAssets.map((a: { id: string }) => a.id);

    // Mark assets as failed
    await supabase
      .from("assets")
      .update({ status: "failed" })
      .in("id", staleIds);

    // Mark their running jobs as failed too
    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error_message: `Timeout: stuck in generating for over ${STALE_MINUTES} minutes`,
        completed_at: new Date().toISOString(),
      })
      .in("asset_id", staleIds)
      .eq("status", "running");

    return NextResponse.json({ cleaned: staleIds.length, assetIds: staleIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cleanup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

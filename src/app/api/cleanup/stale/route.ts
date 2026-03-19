/**
 * POST /api/cleanup/stale
 *
 * Smart cleanup of stuck "generating" assets.
 *
 * Two thresholds:
 * - Jobs WITHOUT external_task_id (submission failed/timed out): 5 minutes
 * - Jobs WITH external_task_id (submitted, provider is processing): 20 minutes
 *
 * This prevents killing legitimate Runway Gen 4.5 jobs that can take 10-15 min.
 *
 * Called automatically by the frontend's auto-poll cycle.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const STALE_NO_SUBMISSION_MINUTES = 5;  // job never submitted to provider
const STALE_WITH_SUBMISSION_MINUTES = 20; // job submitted but provider hasn't finished

export async function POST() {
  try {
    const supabase = createServerClient();

    // 1. Find assets stuck in "generating"
    const { data: staleAssets, error: queryError } = await supabase
      .from("assets")
      .select("id")
      .eq("status", "generating");

    if (queryError || !staleAssets || staleAssets.length === 0) {
      return NextResponse.json({ cleaned: 0 });
    }

    const staleAssetIds = staleAssets.map((a: { id: string }) => a.id);

    // 2. Check their generation_jobs to determine which threshold applies
    const { data: jobsData } = await supabase
      .from("generation_jobs")
      .select("id, asset_id, external_task_id, status, created_at")
      .in("asset_id", staleAssetIds)
      .eq("status", "running")
      .order("created_at", { ascending: false });

    const now = Date.now();
    const toFail: string[] = []; // asset IDs to mark as failed
    const jobsToFail: string[] = []; // job IDs to mark as failed

    for (const assetId of staleAssetIds) {
      // Find the latest running job for this asset
      const job = (jobsData ?? []).find(
        (j: { asset_id: string }) => j.asset_id === assetId
      );

      if (!job) {
        // No running job at all — asset is stuck without a job, always clean up
        const cutoff = now - STALE_NO_SUBMISSION_MINUTES * 60 * 1000;
        // We don't have the asset's updated_at here, but if there's no job, it's definitely stale
        toFail.push(assetId);
        continue;
      }

      const jobAge = now - new Date(job.created_at).getTime();
      const hasSubmission = !!job.external_task_id;

      const threshold = hasSubmission
        ? STALE_WITH_SUBMISSION_MINUTES * 60 * 1000
        : STALE_NO_SUBMISSION_MINUTES * 60 * 1000;

      if (jobAge > threshold) {
        toFail.push(assetId);
        jobsToFail.push(job.id);
      }
    }

    if (toFail.length === 0) {
      return NextResponse.json({ cleaned: 0 });
    }

    // 3. Mark assets as failed
    await supabase
      .from("assets")
      .update({
        status: "failed",
        error_message: "Timeout: geracao demorou mais que o esperado. Tente novamente.",
      })
      .in("id", toFail);

    // 4. Mark their running jobs as failed
    if (jobsToFail.length > 0) {
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_message: "Timeout: provider did not complete in time",
          completed_at: new Date().toISOString(),
        })
        .in("id", jobsToFail);
    }

    return NextResponse.json({ cleaned: toFail.length, assetIds: toFail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cleanup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

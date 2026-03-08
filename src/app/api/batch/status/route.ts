import { NextResponse } from "next/server";
import { checkStatus } from "@/lib/higgsfield";
import { checkStatusGoogle } from "@/lib/google-ai";
import { getLatestBatch, saveBatch, getScene } from "@/lib/store";

/**
 * GET /api/batch/status
 * Check status of every job in the latest batch.
 */
export async function GET() {
  try {
    const batch = await getLatestBatch();

    if (!batch) {
      return NextResponse.json(
        { error: "No batch found" },
        { status: 404 }
      );
    }

    let completed = 0;
    let inProgress = 0;
    let failed = 0;

    // Check status for each job that has a request_id
    for (const job of batch.scenes) {
      if (!job.request_id) {
        // Already failed at submission time
        failed++;
        continue;
      }

      try {
        // Determine provider from the scene
        const scene = await getScene(job.scene_id);
        const isGoogle = scene?.provider === "google";
        const status = isGoogle
          ? await checkStatusGoogle(job.request_id)
          : await checkStatus(job.request_id);
        job.status = status.status;

        if (status.status === "completed") {
          completed++;
        } else if (
          status.status === "failed" ||
          status.status === "cancelled" ||
          status.status === "nsfw"
        ) {
          failed++;
        } else {
          inProgress++;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Status check failed";
        job.status = "error";
        job.error = errMsg;
        failed++;
      }
    }

    const total = batch.scenes.length;

    batch.status_summary = {
      completed,
      in_progress: inProgress,
      failed,
      total,
      percent_complete: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
    batch.last_check = new Date().toISOString();

    // Persist updated statuses
    await saveBatch(batch);

    return NextResponse.json({ batch });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to check batch status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

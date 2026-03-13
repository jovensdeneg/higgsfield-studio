/**
 * POST /api/jobs/poll
 *
 * Polls the status of running video generation jobs and updates Supabase.
 *
 * Body: { jobIds?: string[], projectId?: string }
 * - If jobIds provided, poll those specific jobs
 * - If projectId provided, poll all running jobs for that project's assets
 * - If neither, poll all running jobs
 *
 * For each running job:
 * 1. Check external_task_id exists
 * 2. Route to provider (google_* -> Google AI, otherwise -> Higgsfield)
 * 3. If completed: update job status, result_url, completed_at; update asset video_url + status "ready"
 * 4. If failed: update job status, error_message, completed_at; update asset status "failed"
 * 5. If still running: leave as-is, return progress if available
 *
 * Returns: { polled, completed, failed, running, results[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { checkStatus, getResult } from "@/lib/higgsfield";
import { checkStatusGoogle, getResultGoogle } from "@/lib/google-ai";
import type { GenerationJobRow } from "@/types";

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine -- poll all running jobs
    }

    const { jobIds, projectId } = body as {
      jobIds?: string[];
      projectId?: string;
    };

    const supabase = createServerClient();

    // ── Build query for running jobs ──────────────────────────────────────

    let query = supabase
      .from("generation_jobs")
      .select("*")
      .eq("status", "running");

    if (jobIds && Array.isArray(jobIds) && jobIds.length > 0) {
      // Poll specific jobs by ID
      query = query.in("id", jobIds);
    } else if (projectId) {
      // Poll all running jobs for a project's assets
      const { data: assetIds } = await supabase
        .from("assets")
        .select("id")
        .eq("project_id", projectId);

      if (!assetIds || assetIds.length === 0) {
        return NextResponse.json({
          polled: 0,
          completed: 0,
          failed: 0,
          running: 0,
          results: [],
        });
      }

      query = query.in(
        "asset_id",
        assetIds.map((a: { id: string }) => a.id)
      );
    }
    // If neither jobIds nor projectId, query fetches all running jobs

    const { data: jobsData, error: jobsError } = await query;

    if (jobsError) {
      return NextResponse.json(
        { error: `Failed to fetch jobs: ${jobsError.message}` },
        { status: 500 }
      );
    }

    const jobs = (jobsData ?? []) as unknown as GenerationJobRow[];

    // ── Poll each job ─────────────────────────────────────────────────────

    const results: Array<{
      jobId: string;
      status: "completed" | "failed" | "running";
      progress?: number;
      resultUrl?: string;
      error?: string;
    }> = [];

    for (const job of jobs) {
      // 1. Must have an external task ID to poll
      if (!job.external_task_id) {
        results.push({
          jobId: job.id,
          status: "running",
          error: "No external_task_id — skipping",
        });
        continue;
      }

      // 2. Determine provider
      const isGoogle = job.provider.startsWith("google_");

      try {
        const statusResult = isGoogle
          ? await checkStatusGoogle(job.external_task_id)
          : await checkStatus(job.external_task_id);

        const externalStatus = statusResult.status;

        // 3. Completed
        if (externalStatus === "completed") {
          let videoUrl: string | null = null;

          // Fetch the full result to get the video URL
          try {
            const fullResult = isGoogle
              ? await getResultGoogle(job.external_task_id)
              : await getResult(job.external_task_id);

            // Google returns video_url directly
            if (fullResult.video_url) {
              videoUrl = fullResult.video_url as string;
            }
            // Higgsfield may return videos array or other formats
            else if (fullResult.videos && Array.isArray(fullResult.videos)) {
              const first = fullResult.videos[0];
              videoUrl =
                typeof first === "string"
                  ? first
                  : ((first as Record<string, string>)?.url ?? null);
            } else if (fullResult.output) {
              videoUrl = fullResult.output as string;
            }

            // Check for Google RAI errors (completed but filtered)
            if (isGoogle && !videoUrl) {
              const raiError = fullResult.rai_error as string | undefined;
              if (raiError) {
                const now = new Date().toISOString();
                await supabase
                  .from("generation_jobs")
                  .update({
                    status: "failed",
                    error_message: raiError,
                    completed_at: now,
                  })
                  .eq("id", job.id);

                await supabase
                  .from("assets")
                  .update({ status: "failed" })
                  .eq("id", job.asset_id);

                results.push({
                  jobId: job.id,
                  status: "failed",
                  error: raiError,
                });
                continue;
              }
            }
          } catch {
            // If getResult fails, we still mark completed but without URL
          }

          const now = new Date().toISOString();

          await supabase
            .from("generation_jobs")
            .update({
              status: "completed",
              result_url: videoUrl,
              completed_at: now,
            })
            .eq("id", job.id);

          await supabase
            .from("assets")
            .update({
              video_url: videoUrl,
              status: "ready",
            })
            .eq("id", job.asset_id);

          results.push({
            jobId: job.id,
            status: "completed",
            resultUrl: videoUrl ?? undefined,
          });
          continue;
        }

        // 4. Failed
        if (externalStatus === "failed") {
          const errorMessage = "Job failed (no details from provider)";
          const now = new Date().toISOString();

          await supabase
            .from("generation_jobs")
            .update({
              status: "failed",
              error_message: errorMessage.slice(0, 2000),
              completed_at: now,
            })
            .eq("id", job.id);

          await supabase
            .from("assets")
            .update({ status: "failed" })
            .eq("id", job.asset_id);

          results.push({
            jobId: job.id,
            status: "failed",
            error: errorMessage,
          });
          continue;
        }

        // 5. Still running (pending or running)
        results.push({
          jobId: job.id,
          status: "running",
          progress: statusResult.progress,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        results.push({
          jobId: job.id,
          status: "running",
          error: `Poll error: ${errMsg}`,
        });
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────

    const completed = results.filter((r) => r.status === "completed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const running = results.filter((r) => r.status === "running").length;

    return NextResponse.json({
      polled: jobs.length,
      completed,
      failed,
      running,
      results,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to poll jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

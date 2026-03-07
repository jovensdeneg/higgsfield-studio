import { NextRequest, NextResponse } from "next/server";
import { getResult } from "@/lib/higgsfield";
import { getLatestBatch, saveBatch, updateScene } from "@/lib/store";

/**
 * POST /api/batch/collect
 * Collect video URLs for all completed jobs in the latest batch.
 *
 * Body: {
 *   download_local?: boolean;  // ignored in web version, included for API parity
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // download_local is accepted but not used in the web version
    const _downloadLocal = (body as { download_local?: boolean }).download_local ?? false;

    const batch = await getLatestBatch();

    if (!batch) {
      return NextResponse.json(
        { error: "No batch found" },
        { status: 404 }
      );
    }

    const results: {
      scene_id: string;
      request_id: string;
      video_url: string | null;
      status: string;
      error?: string;
    }[] = [];

    for (const job of batch.scenes) {
      if (!job.request_id) {
        results.push({
          scene_id: job.scene_id,
          request_id: "",
          video_url: null,
          status: job.status,
          error: job.error ?? "No request_id",
        });
        continue;
      }

      try {
        const data = await getResult(job.request_id);
        const status = (data.status as string) ?? "unknown";

        let videoUrl: string | null = null;

        if (status === "completed") {
          // Extract video URL from result
          if (data.video_url) {
            videoUrl = data.video_url as string;
          } else if (data.output) {
            videoUrl = data.output as string;
          } else if (data.videos && Array.isArray(data.videos)) {
            const first = data.videos[0];
            videoUrl =
              typeof first === "string"
                ? first
                : (first as Record<string, string>)?.url ?? null;
          }

          // Update scene with video URL
          if (videoUrl) {
            await updateScene(job.scene_id, {
              video_url: videoUrl,
              status: "completed",
            });
          }
        }

        job.status = status;

        results.push({
          scene_id: job.scene_id,
          request_id: job.request_id,
          video_url: videoUrl,
          status,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Failed to get result";
        results.push({
          scene_id: job.scene_id,
          request_id: job.request_id,
          video_url: null,
          status: "error",
          error: errMsg,
        });
      }
    }

    // Persist updated batch
    await saveBatch(batch);

    const collected = results.filter((r) => r.video_url !== null).length;

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        collected,
        pending: results.length - collected,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to collect batch results";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

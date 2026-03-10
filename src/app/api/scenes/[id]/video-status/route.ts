import { NextResponse } from "next/server";
import { getScene, updateScene } from "@/lib/store";
import { checkStatus, getResult } from "@/lib/higgsfield";
import { checkStatusGoogle, getResultGoogle } from "@/lib/google-ai";

/**
 * GET /api/scenes/[id]/video-status
 * Check and update the video generation status for a single scene.
 *
 * - If video_submitted + request_id → check external API status
 * - If completed → try to collect the video URL
 * - Returns updated scene + video_status info
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let scene = await getScene(id);

    if (!scene) {
      return NextResponse.json(
        { error: `Scene '${id}' not found` },
        { status: 404 }
      );
    }

    // Only check if we have a pending video submission
    if (scene.status !== "video_submitted" || !scene.request_id) {
      return NextResponse.json({
        scene,
        video_status: {
          status: scene.status,
          progress: scene.status === "completed" ? 100 : 0,
        },
      });
    }

    const isGoogle = scene.provider === "google";

    try {
      // Step 1: Check status
      const statusResult = isGoogle
        ? await checkStatusGoogle(scene.request_id)
        : await checkStatus(scene.request_id);

      if (statusResult.status === "completed") {
        // Step 2: Collect video result
        try {
          const resultData = isGoogle
            ? await getResultGoogle(scene.request_id)
            : await getResult(scene.request_id);

          // Extract video URL
          let videoUrl: string | null = null;

          if (resultData.video_url) {
            videoUrl = resultData.video_url as string;
          } else if (resultData.output) {
            videoUrl = resultData.output as string;
          } else if (resultData.videos && Array.isArray(resultData.videos)) {
            const first = resultData.videos[0];
            videoUrl =
              typeof first === "string"
                ? first
                : (first as Record<string, string>)?.url ?? null;
          }

          if (videoUrl) {
            scene = await updateScene(id, {
              video_url: videoUrl,
              status: "completed",
              error_message: null,
            });
          } else {
            scene = await updateScene(id, {
              status: "completed",
              error_message: "Video concluido mas URL nao encontrada no resultado.",
            });
          }
        } catch (collectErr) {
          const errMsg =
            collectErr instanceof Error ? collectErr.message : String(collectErr);
          scene = await updateScene(id, {
            error_message: `Erro ao coletar video: ${errMsg}`,
          });
        }

        return NextResponse.json({
          scene,
          video_status: { status: "completed", progress: 100 },
        });
      }

      if (
        statusResult.status === "failed" ||
        statusResult.status === "cancelled" ||
        statusResult.status === "nsfw"
      ) {
        scene = await updateScene(id, {
          status: "approved",
          request_id: null,
          error_message: `Video falhou: status "${statusResult.status}"`,
        });

        return NextResponse.json({
          scene,
          video_status: { status: "failed", progress: 0 },
        });
      }

      // Still in progress
      return NextResponse.json({
        scene,
        video_status: {
          status: "in_progress",
          progress: statusResult.progress ?? undefined,
        },
      });
    } catch (checkErr) {
      const errMsg =
        checkErr instanceof Error ? checkErr.message : String(checkErr);

      return NextResponse.json({
        scene,
        video_status: {
          status: "error",
          error: errMsg,
        },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to check video status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

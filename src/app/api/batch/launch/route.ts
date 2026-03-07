import { NextRequest, NextResponse } from "next/server";
import { submitVideo } from "@/lib/higgsfield";
import {
  getApprovedScenes,
  updateScene,
  saveBatch,
  type Batch,
  type BatchJob,
} from "@/lib/store";

/**
 * POST /api/batch/launch
 * Launch overnight batch: submit video generation for all approved scenes.
 *
 * Body: {
 *   confirm: boolean;   // must be true to proceed
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { confirm } = body as { confirm: boolean };

    if (confirm !== true) {
      return NextResponse.json(
        { error: "Set 'confirm' to true to launch the batch" },
        { status: 400 }
      );
    }

    const approvedScenes = await getApprovedScenes();

    if (approvedScenes.length === 0) {
      return NextResponse.json(
        { error: "No approved scenes found to launch" },
        { status: 400 }
      );
    }

    const batchId = `batch-${Date.now()}`;
    const jobs: BatchJob[] = [];
    let submitted = 0;
    let failed = 0;

    for (const scene of approvedScenes) {
      // Get the approved image URL (image_index is 1-based)
      const imageIndex = (scene.approved_image_index ?? 1) - 1;
      const startImage = scene.generated_images[imageIndex]?.url;

      if (!startImage) {
        jobs.push({
          scene_id: scene.scene_id,
          request_id: null,
          status: "failed",
          error: "No approved image URL found",
        });
        failed++;
        continue;
      }

      try {
        const submission = await submitVideo({
          prompt: scene.optimized_movement_prompt ?? scene.movement_prompt ?? "",
          startImageUrl: startImage,
          endImageUrl: scene.video_config.end_frame?.image_url,
          model: scene.video_config.model,
          duration: scene.video_config.duration,
          preset: scene.video_config.preset ?? undefined,
        });

        jobs.push({
          scene_id: scene.scene_id,
          request_id: submission.request_id,
          prompt_sent: scene.optimized_movement_prompt ?? scene.movement_prompt ?? "",
          model: scene.video_config.model,
          status: "submitted",
        });

        // Update scene with request_id and status
        await updateScene(scene.scene_id, {
          request_id: submission.request_id,
          status: "video_submitted",
        });

        submitted++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        jobs.push({
          scene_id: scene.scene_id,
          request_id: null,
          status: "failed",
          error: errMsg,
        });
        failed++;
      }
    }

    const batch: Batch = {
      batch_id: batchId,
      scenes: jobs,
      total_scenes: approvedScenes.length,
      submitted,
      failed,
      created_at: new Date().toISOString(),
    };

    await saveBatch(batch);

    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to launch batch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

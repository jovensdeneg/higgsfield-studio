import { NextRequest, NextResponse } from "next/server";
import { getScene, updateScene } from "@/lib/store";
import { submitVideo } from "@/lib/higgsfield";
import { submitVideoGoogle } from "@/lib/google-ai";

/**
 * POST /api/scenes/[id]/approve
 * Approve a scene, configure video, and auto-submit for video production.
 *
 * Body: {
 *   image_index: number;          // 1-based index of the approved image
 *   movement_prompt: string;      // description of desired motion
 *   video_model?: string;         // default "kling-3.0" or "veo-3.1"
 *   duration?: number;            // seconds
 *   preset?: string;              // camera preset (optional, Higgsfield only)
 *   end_frame_url?: string;       // end frame image URL (optional)
 *   end_frame_index?: number;     // 1-based index of approved end frame
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scene = await getScene(id);

    if (!scene) {
      return NextResponse.json(
        { error: `Scene '${id}' not found` },
        { status: 404 }
      );
    }

    const body = await request.json();

    const {
      image_index,
      end_frame_index,
      movement_prompt,
      video_model,
      duration,
      preset,
      end_frame_url,
    } = body as {
      image_index: number;
      end_frame_index?: number;
      movement_prompt: string;
      video_model?: string;
      duration?: number;
      preset?: string;
      end_frame_url?: string;
    };

    if (image_index == null || typeof image_index !== "number") {
      return NextResponse.json(
        { error: "Field 'image_index' is required and must be a number" },
        { status: 400 }
      );
    }

    if (!movement_prompt || typeof movement_prompt !== "string") {
      return NextResponse.json(
        { error: "Field 'movement_prompt' is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate image_index is within range (1-based)
    if (image_index < 1 || image_index > scene.generated_images.length) {
      return NextResponse.json(
        {
          error: `image_index must be between 1 and ${scene.generated_images.length}`,
        },
        { status: 400 }
      );
    }

    // Derive end frame URL from scene data or explicit URL
    let endFrameConfig: { type: string; image_url: string } | null = null;

    if (end_frame_index && scene.end_frame_generated_images?.length) {
      if (end_frame_index < 1 || end_frame_index > scene.end_frame_generated_images.length) {
        return NextResponse.json(
          { error: `end_frame_index must be between 1 and ${scene.end_frame_generated_images.length}` },
          { status: 400 }
        );
      }
      endFrameConfig = {
        type: "image_url",
        image_url: scene.end_frame_generated_images[end_frame_index - 1].url,
      };
    } else if (end_frame_url) {
      endFrameConfig = { type: "image_url", image_url: end_frame_url };
    }

    // ---- Step 1: Save approval config ----
    const videoConfig = {
      model: video_model ?? "kling-3.0",
      duration: duration ?? 5,
      resolution: "1080p",
      preset: preset ?? null,
      end_frame: endFrameConfig,
    };

    let updated = await updateScene(id, {
      approved_image_index: image_index,
      end_frame_approved_index: end_frame_index ?? null,
      movement_prompt: movement_prompt,
      optimized_movement_prompt: movement_prompt,
      video_config: videoConfig,
      status: "approved",
      error_message: null,
    });

    // ---- Step 2: Auto-submit video for production ----
    const startImageUrl = scene.generated_images[image_index - 1]?.url;

    if (!startImageUrl) {
      updated = await updateScene(id, {
        error_message: "Imagem aprovada nao encontrada. Regenere as imagens.",
      });
      return NextResponse.json({ scene: updated });
    }

    try {
      const isGoogle = scene.provider === "google";

      const submission = isGoogle
        ? await submitVideoGoogle({
            prompt: movement_prompt.trim(),
            startImageUrl,
            endImageUrl: endFrameConfig?.image_url,
            model: videoConfig.model,
            duration: videoConfig.duration,
          })
        : await submitVideo({
            prompt: movement_prompt.trim(),
            startImageUrl,
            endImageUrl: endFrameConfig?.image_url,
            model: videoConfig.model,
            duration: videoConfig.duration,
            preset: videoConfig.preset ?? undefined,
          });

      updated = await updateScene(id, {
        request_id: submission.request_id,
        status: "video_submitted",
        error_message: null,
      });
    } catch (submitErr) {
      const errMsg =
        submitErr instanceof Error ? submitErr.message : String(submitErr);
      console.error(`[approve/${id}] Falha ao submeter video:`, errMsg);

      // Keep status as "approved" so user can retry
      updated = await updateScene(id, {
        error_message: `Falha ao enviar video: ${errMsg}`,
      });
    }

    return NextResponse.json({ scene: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to approve scene";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

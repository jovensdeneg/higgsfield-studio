import { NextRequest, NextResponse } from "next/server";
import { getScene, updateScene } from "@/lib/store";

/**
 * POST /api/scenes/[id]/approve
 * Approve a scene by selecting an image and configuring video generation.
 *
 * Body: {
 *   image_index: number;          // 1-based index of the approved image
 *   movement_prompt: string;      // description of desired motion
 *   video_model?: string;         // default "kling-3.0"
 *   duration?: number;            // 5, 10, or 15 seconds
 *   preset?: string;              // camera preset (optional)
 *   end_frame_url?: string;       // end frame image URL (optional)
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
      movement_prompt,
      video_model,
      duration,
      preset,
      end_frame_url,
    } = body as {
      image_index: number;
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

    const updated = await updateScene(id, {
      approved_image_index: image_index,
      movement_prompt: movement_prompt,
      optimized_movement_prompt: movement_prompt,
      video_config: {
        model: video_model ?? "kling-3.0",
        duration: duration ?? 5,
        resolution: "1080p",
        preset: preset ?? null,
        end_frame: end_frame_url
          ? { type: "image_url", image_url: end_frame_url }
          : null,
      },
      status: "approved",
    });

    return NextResponse.json({ scene: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to approve scene";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

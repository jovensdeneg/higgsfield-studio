import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/higgsfield";
import { getScene, updateScene } from "@/lib/store";

/**
 * POST /api/scenes/[id]/regenerate
 * Regenerate images for a scene that didn't turn out well.
 *
 * Body: {
 *   new_prompt?: string;        // new image prompt (uses previous if omitted)
 *   new_model?: string;         // new image model (uses previous if omitted)
 *   num_variations?: number;    // default 3
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

    const { new_prompt, new_model, num_variations } = body as {
      new_prompt?: string;
      new_model?: string;
      num_variations?: number;
    };

    const prompt = new_prompt ?? scene.optimized_prompt;
    const imageModel = new_model ?? scene.model_image;
    const variations = num_variations ?? 3;

    // Generate images sequentially to avoid rate limits
    const generatedImages: { url: string; metadata?: Record<string, unknown> }[] = [];

    for (let i = 0; i < variations; i++) {
      const result = await generateImage(prompt, imageModel);
      generatedImages.push({
        url: result.url,
        metadata: result.raw,
      });
    }

    const updated = await updateScene(id, {
      optimized_prompt: prompt,
      model_image: imageModel,
      generated_images: generatedImages,
      approved_image_index: null,
      movement_prompt: null,
      optimized_movement_prompt: null,
      status: "images_generated",
      request_id: null,
      video_url: null,
    });

    return NextResponse.json({ scene: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to regenerate scene";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

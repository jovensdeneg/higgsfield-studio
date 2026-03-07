import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/higgsfield";
import { getScene, updateScene, getCharacter } from "@/lib/store";

/**
 * POST /api/scenes/[id]/regenerate
 * Regenerate images for a scene that didn't turn out well.
 *
 * Body: {
 *   new_prompt?: string;        // new image prompt (uses previous if omitted)
 *   new_model?: string;         // new image model (uses previous if omitted)
 *   num_variations?: number;    // default 3
 *   target?: "start" | "end";   // which frame to regenerate (default "start")
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

    const { new_prompt, new_model, num_variations, target } = body as {
      new_prompt?: string;
      new_model?: string;
      num_variations?: number;
      target?: "start" | "end";
    };

    const frameTarget = target ?? "start";
    const variations = num_variations ?? 3;

    // Resolve prompt, model, and reference images based on target
    let prompt: string;
    let imageModel: string;
    let referenceImages: string[] = [];

    if (frameTarget === "end") {
      prompt =
        new_prompt ??
        scene.end_frame_optimized_prompt ??
        scene.end_frame_prompt ??
        scene.optimized_prompt;
      imageModel =
        new_model ??
        scene.end_frame_model_image ??
        scene.model_image;
      referenceImages = [...(scene.end_frame_reference_images ?? [])];
    } else {
      prompt = new_prompt ?? scene.optimized_prompt;
      imageModel = new_model ?? scene.model_image;
      referenceImages = [...(scene.reference_images ?? [])];
    }

    // Include character photos if scene has a character_id
    const characterId = scene.character_id;
    if (characterId) {
      const character = await getCharacter(characterId);
      if (character && character.photos.length > 0) {
        const charUrls = character.photos.map((p) => p.url);
        referenceImages = [...charUrls, ...referenceImages];
      }
    }

    // Generate images sequentially to avoid rate limits
    const generatedImages: { url: string; metadata?: Record<string, unknown> }[] = [];

    for (let i = 0; i < variations; i++) {
      const result = await generateImage(
        prompt,
        imageModel,
        referenceImages.length > 0 ? referenceImages : undefined
      );
      generatedImages.push({
        url: result.url,
        metadata: result.raw,
      });
    }

    // Build update payload based on target
    let updatePayload: Record<string, unknown>;

    if (frameTarget === "end") {
      updatePayload = {
        end_frame_optimized_prompt: prompt,
        end_frame_model_image: imageModel,
        end_frame_generated_images: generatedImages,
        end_frame_approved_index: null,
      };
    } else {
      updatePayload = {
        optimized_prompt: prompt,
        model_image: imageModel,
        generated_images: generatedImages,
        approved_image_index: null,
        movement_prompt: null,
        optimized_movement_prompt: null,
        status: "images_generated",
        request_id: null,
        video_url: null,
      };
    }

    const updated = await updateScene(id, updatePayload);

    return NextResponse.json({ scene: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to regenerate scene";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

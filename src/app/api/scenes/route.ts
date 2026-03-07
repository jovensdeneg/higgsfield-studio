import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/higgsfield";
import {
  createScene,
  listScenes,
  getNextSceneId,
  type Scene,
} from "@/lib/store";

/**
 * GET /api/scenes
 * List all scenes, sorted by created_at descending (handled by store).
 */
export async function GET() {
  try {
    const scenes = await listScenes();
    return NextResponse.json({ scenes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list scenes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/scenes
 * Generate a new scene with image variations.
 *
 * Body: {
 *   prompt: string;
 *   model?: string;           // default "nano-banana-pro"
 *   num_variations?: number;   // default 3
 *   reference_images?: string[];
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { prompt, model, num_variations, reference_images } = body as {
      prompt: string;
      model?: string;
      num_variations?: number;
      reference_images?: string[];
    };

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Field 'prompt' is required and must be a string" },
        { status: 400 }
      );
    }

    const imageModel = model ?? "nano-banana-pro";
    const variations = num_variations ?? 3;
    const sceneId = await getNextSceneId();

    // Generate images sequentially to avoid rate limits
    const generatedImages: { url: string; metadata?: Record<string, unknown> }[] = [];

    for (let i = 0; i < variations; i++) {
      const result = await generateImage(prompt, imageModel, reference_images);
      generatedImages.push({
        url: result.url,
        metadata: result.raw,
      });
    }

    const now = new Date().toISOString();

    const scene: Scene = {
      scene_id: sceneId,
      original_prompt: prompt,
      optimized_prompt: prompt,
      model_image: imageModel,
      generated_images: generatedImages,
      approved_image_index: null,
      movement_prompt: null,
      optimized_movement_prompt: null,
      video_config: {
        model: "kling-3.0",
        duration: 5,
        resolution: "1080p",
        preset: null,
        end_frame: null,
      },
      status: "images_generated",
      request_id: null,
      video_url: null,
      created_at: now,
      updated_at: now,
    };

    const created = await createScene(scene);

    return NextResponse.json({ scene: created }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate scene";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

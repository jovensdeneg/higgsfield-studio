import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/higgsfield";
import { generateImageGoogle } from "@/lib/google-ai";
import {
  createScene,
  listScenes,
  getNextSceneId,
  getCharacter,
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
 * Generate a new scene with image variations (start frame + optional end frame).
 *
 * Body: {
 *   prompt: string;
 *   model?: string;
 *   num_variations?: number;
 *   reference_images?: string[];
 *   character_id?: string;
 *   end_frame_prompt?: string;
 *   end_frame_model?: string;
 *   end_frame_num_variations?: number;
 *   end_frame_reference_images?: string[];
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      prompt,
      model,
      num_variations,
      reference_images,
      character_id,
      end_frame_prompt,
      end_frame_model,
      end_frame_num_variations,
      end_frame_reference_images,
      provider,
    } = body as {
      prompt: string;
      model?: string;
      num_variations?: number;
      reference_images?: string[];
      character_id?: string;
      end_frame_prompt?: string;
      end_frame_model?: string;
      end_frame_num_variations?: number;
      end_frame_reference_images?: string[];
      provider?: "higgsfield" | "google";
    };

    const useGoogle = provider === "google";

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Field 'prompt' is required and must be a string" },
        { status: 400 }
      );
    }

    const imageModel = model ?? "nano-banana-pro";
    const variations = num_variations ?? 3;
    const sceneId = await getNextSceneId();

    // Merge character photos into reference images
    let allRefs = [...(reference_images ?? [])];
    if (character_id) {
      const character = await getCharacter(character_id);
      if (character && character.photos.length > 0) {
        const charUrls = character.photos.map((p) => p.url);
        allRefs = [...charUrls, ...allRefs];
      }
    }

    // Generate START FRAME images
    const generatedImages: { url: string; metadata?: Record<string, unknown> }[] = [];
    for (let i = 0; i < variations; i++) {
      const result = useGoogle
        ? await generateImageGoogle(prompt, imageModel)
        : await generateImage(prompt, imageModel, allRefs.length > 0 ? allRefs : undefined);
      generatedImages.push({ url: result.url, metadata: result.raw });
    }

    // Generate END FRAME images (optional)
    const endFrameImages: { url: string; metadata?: Record<string, unknown> }[] = [];
    const efModel = end_frame_model ?? imageModel;
    const efVariations = end_frame_num_variations ?? variations;

    if (end_frame_prompt && end_frame_prompt.trim()) {
      let endRefs = [...(end_frame_reference_images ?? [])];
      // Also include character photos for end frame consistency
      if (character_id) {
        const character = await getCharacter(character_id);
        if (character && character.photos.length > 0) {
          const charUrls = character.photos.map((p) => p.url);
          endRefs = [...charUrls, ...endRefs];
        }
      }

      for (let i = 0; i < efVariations; i++) {
        const result = useGoogle
          ? await generateImageGoogle(end_frame_prompt.trim(), efModel)
          : await generateImage(end_frame_prompt.trim(), efModel, endRefs.length > 0 ? endRefs : undefined);
        endFrameImages.push({ url: result.url, metadata: result.raw });
      }
    }

    const now = new Date().toISOString();

    const scene: Scene = {
      scene_id: sceneId,
      original_prompt: prompt,
      optimized_prompt: prompt,
      model_image: imageModel,
      generated_images: generatedImages,
      approved_image_index: null,
      reference_images: allRefs,
      character_id: character_id ?? null,
      movement_prompt: null,
      optimized_movement_prompt: null,
      end_frame_prompt: end_frame_prompt?.trim() ?? null,
      end_frame_optimized_prompt: end_frame_prompt?.trim() ?? null,
      end_frame_model_image: endFrameImages.length > 0 ? efModel : null,
      end_frame_generated_images: endFrameImages,
      end_frame_approved_index: null,
      end_frame_reference_images: end_frame_reference_images ?? [],
      video_config: {
        model: useGoogle ? "veo-3.1" : "kling-3.0",
        duration: useGoogle ? 8 : 5,
        resolution: "1080p",
        preset: null,
        end_frame: null,
      },
      provider: useGoogle ? "google" : "higgsfield",
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

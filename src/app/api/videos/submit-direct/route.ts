import { NextRequest, NextResponse } from "next/server";
import { submitVideo } from "@/lib/higgsfield";
import { submitVideoGoogle } from "@/lib/google-ai";
import { createScene, getNextSceneId } from "@/lib/store";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/videos/submit-direct
 * Submit a video directly from images the user already has.
 * Creates a scene record for tracking in Monitor de Producao and Galeria.
 *
 * Body: {
 *   start_image_url: string;
 *   movement_prompt: string;
 *   model?: string;           // default "kling-3.0" or "veo-3.1"
 *   duration?: number;        // seconds
 *   end_image_url?: string;
 *   preset?: string;          // camera preset
 *   provider?: "higgsfield" | "google";
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      start_image_url,
      movement_prompt,
      model,
      duration,
      end_image_url,
      preset,
      provider,
    } = body as {
      start_image_url: string;
      movement_prompt: string;
      model?: string;
      duration?: number;
      end_image_url?: string;
      preset?: string;
      provider?: "higgsfield" | "google";
    };

    if (!start_image_url || typeof start_image_url !== "string") {
      return NextResponse.json(
        { error: "Field 'start_image_url' is required and must be a string" },
        { status: 400 }
      );
    }

    if (!movement_prompt || typeof movement_prompt !== "string") {
      return NextResponse.json(
        { error: "Field 'movement_prompt' is required and must be a string" },
        { status: 400 }
      );
    }

    const isGoogle = provider === "google";
    const videoModel = model ?? (isGoogle ? "veo-3.1" : "kling-3.0");
    const videoDuration = duration ?? (isGoogle ? 8 : 5);

    const submission = isGoogle
      ? await submitVideoGoogle({
          prompt: movement_prompt,
          startImageUrl: start_image_url,
          endImageUrl: end_image_url,
          model: videoModel,
          duration: videoDuration,
        })
      : await submitVideo({
          prompt: movement_prompt,
          startImageUrl: start_image_url,
          endImageUrl: end_image_url,
          model: videoModel,
          duration: videoDuration,
          preset,
        });

    // Create a scene record so the video is tracked in Monitor and Galeria
    const sceneId = await getNextSceneId();
    const now = new Date().toISOString();

    const scene = await createScene({
      scene_id: sceneId,
      original_prompt: movement_prompt,
      optimized_prompt: movement_prompt,
      model_image: isGoogle ? "nano-banana-pro" : "flux-pro-kontext-max",
      generated_images: [{ url: start_image_url }],
      approved_image_index: 1,
      reference_images: [],
      character_id: null,
      movement_prompt: movement_prompt,
      optimized_movement_prompt: movement_prompt,
      end_frame_prompt: null,
      end_frame_optimized_prompt: null,
      end_frame_model_image: null,
      end_frame_generated_images: end_image_url ? [{ url: end_image_url }] : [],
      end_frame_approved_index: end_image_url ? 1 : null,
      end_frame_reference_images: [],
      video_config: {
        model: videoModel,
        duration: videoDuration,
        resolution: "720p",
        preset: preset ?? null,
        end_frame: end_image_url
          ? { type: "image_url", image_url: end_image_url }
          : null,
      },
      provider: isGoogle ? "google" : "higgsfield",
      status: "video_submitted",
      request_id: submission.request_id,
      video_url: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    });

    // Also save to Supabase assets table for gallery
    try {
      const supabase = createServerClient();

      // Ensure a "Video Direto" project exists
      const VD_NAME = "Video Direto";
      let projectId: string;
      const { data: existingProj } = await supabase
        .from("projects")
        .select("id")
        .eq("name", VD_NAME)
        .limit(1)
        .single();

      if (existingProj) {
        projectId = (existingProj as { id: string }).id;
      } else {
        const { data: created } = await supabase
          .from("projects")
          .insert({ name: VD_NAME })
          .select("id")
          .single();
        projectId = (created as { id: string }).id;
      }

      const code = `VID-${Date.now().toString(36).toUpperCase()}`;
      await supabase.from("assets").insert({
        project_id: projectId,
        asset_code: code,
        scene: sceneId,
        description: movement_prompt.trim().slice(0, 200),
        asset_type: "image_to_video",
        image_url: start_image_url,
        image1_url: start_image_url,
        image2_url: end_image_url ?? null,
        prompt_video: movement_prompt.trim(),
        video_tool: isGoogle ? "google_veo" : "higgsfield_kling",
        status: "generating",
        sort_order: 0,
      });
    } catch {
      console.error("[submit-direct] Failed to save to gallery");
    }

    return NextResponse.json(
      {
        request_id: submission.request_id,
        status_url: submission.status_url,
        cancel_url: submission.cancel_url,
        scene_id: scene.scene_id,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit video";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

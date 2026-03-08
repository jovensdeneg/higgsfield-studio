import { NextRequest, NextResponse } from "next/server";
import { submitVideo } from "@/lib/higgsfield";
import { submitVideoGoogle } from "@/lib/google-ai";

/**
 * POST /api/videos/submit-direct
 * Submit a video directly from images the user already has.
 *
 * Body: {
 *   start_image_url: string;
 *   movement_prompt: string;
 *   model?: string;           // default "kling-3.0"
 *   duration?: number;        // 5, 10, or 15 seconds
 *   end_image_url?: string;
 *   preset?: string;          // camera preset
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

    const submission = provider === "google"
      ? await submitVideoGoogle({
          prompt: movement_prompt,
          startImageUrl: start_image_url,
          endImageUrl: end_image_url,
          model: model ?? "veo-3.1",
          duration: duration ?? 8,
        })
      : await submitVideo({
          prompt: movement_prompt,
          startImageUrl: start_image_url,
          endImageUrl: end_image_url,
          model: model ?? "kling-3.0",
          duration: duration ?? 5,
          preset,
        });

    return NextResponse.json(
      {
        request_id: submission.request_id,
        status_url: submission.status_url,
        cancel_url: submission.cancel_url,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit video";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/assets/[assetId]/regenerate
 *
 * Resets an asset to "pending" for re-generation.
 * Optionally accepts { prompt_image?: string, image_tool?: string } to change params.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { GenerationTool } from "@/types";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const { assetId } = await ctx.params;

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }

    const { prompt_image, image_tool } = body as {
      prompt_image?: string;
      image_tool?: string;
    };

    const updates: Record<string, unknown> = {
      status: "pending",
      image_url: null,
      video_url: null,
      review_notes: null,
    };

    if (prompt_image && typeof prompt_image === "string") {
      updates.prompt_image = prompt_image;
    }

    if (image_tool && typeof image_tool === "string") {
      updates.image_tool = image_tool as GenerationTool;
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("assets")
      .update(updates)
      .eq("id", assetId)
      .select()
      .single();

    if (error) {
      const status = error.code === "PGRST116" ? 404 : 500;
      return NextResponse.json(
        { error: error.message },
        { status },
      );
    }

    return NextResponse.json({ asset: data });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to regenerate asset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

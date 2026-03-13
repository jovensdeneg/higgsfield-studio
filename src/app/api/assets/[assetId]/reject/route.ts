/**
 * POST /api/assets/[assetId]/reject
 *
 * Sets asset status to "rejected".
 * Body: { review_notes: string } (required, min 5 chars)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const { assetId } = await ctx.params;
    const body = await request.json();
    const { review_notes } = body as { review_notes?: string };

    if (
      !review_notes ||
      typeof review_notes !== "string" ||
      review_notes.trim().length < 5
    ) {
      return NextResponse.json(
        {
          error:
            "'review_notes' is required and must be at least 5 characters",
        },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("assets")
      .update({
        status: "rejected",
        review_notes: review_notes.trim(),
      })
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
      err instanceof Error ? err.message : "Failed to reject asset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

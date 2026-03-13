/**
 * POST /api/assets/[assetId]/approve
 *
 * Sets asset status to "approved". No body needed.
 */
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function POST(_request: Request, ctx: RouteContext) {
  try {
    const { assetId } = await ctx.params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("assets")
      .update({ status: "approved" })
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
      err instanceof Error ? err.message : "Failed to approve asset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

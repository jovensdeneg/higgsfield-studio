/**
 * API routes for assets within a project.
 *
 * GET   /api/projects/[projectId]/assets — List assets with optional filters.
 * PATCH /api/projects/[projectId]/assets — Bulk update assets.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { AssetRow, AssetStatus, AssetType } from "@/types";

type RouteContext = { params: Promise<{ projectId: string }> };

/**
 * GET /api/projects/[projectId]/assets
 *
 * Returns assets for the given project, ordered by sort_order.
 *
 * Optional query parameters:
 *   - status     — Filter by asset_status enum value.
 *   - scene      — Filter by scene name (exact match).
 *   - asset_type — Filter by asset_type enum value.
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const supabase = createServerClient();
    const { searchParams } = request.nextUrl;

    let query = supabase
      .from("assets")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });

    // ── Apply optional filters ──
    const statusFilter = searchParams.get("status");
    if (statusFilter) {
      query = query.eq("status", statusFilter as AssetStatus);
    }

    const sceneFilter = searchParams.get("scene");
    if (sceneFilter) {
      query = query.eq("scene", sceneFilter);
    }

    const typeFilter = searchParams.get("asset_type");
    if (typeFilter) {
      query = query.eq("asset_type", typeFilter as AssetType);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const assets = (data ?? []) as unknown as AssetRow[];

    return NextResponse.json({ assets });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list assets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[projectId]/assets
 *
 * Bulk update assets belonging to this project.
 *
 * Request body:
 * ```json
 * {
 *   "asset_ids": ["uuid-1", "uuid-2"],
 *   "updates": {
 *     "status": "approved",
 *     "review_notes": "Looks good"
 *   }
 * }
 * ```
 *
 * Allowed update fields: status, review_notes, image_url, video_url,
 * thumbnail_url, prompt_image, prompt_video.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const body = await request.json();

    const { asset_ids, updates } = body as {
      asset_ids?: string[];
      updates?: Record<string, unknown>;
    };

    if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
      return NextResponse.json(
        { error: "'asset_ids' must be a non-empty array of UUIDs" },
        { status: 400 },
      );
    }

    if (!updates || typeof updates !== "object") {
      return NextResponse.json(
        { error: "'updates' must be an object with fields to update" },
        { status: 400 },
      );
    }

    // Whitelist allowed fields to prevent arbitrary column updates
    const ALLOWED_FIELDS = new Set([
      "status",
      "review_notes",
      "image_url",
      "image1_url",
      "image2_url",
      "video_url",
      "thumbnail_url",
      "prompt_image",
      "prompt_image1",
      "prompt_image2",
      "prompt_video",
      "error_message",
    ]);

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_FIELDS.has(key)) {
        sanitized[key] = value;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json(
        {
          error: `No valid fields to update. Allowed: ${[...ALLOWED_FIELDS].join(", ")}`,
        },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("assets")
      .update(sanitized as never)
      .eq("project_id", projectId)
      .in("id", asset_ids)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const assets = (data ?? []) as unknown as AssetRow[];

    return NextResponse.json({
      updated: assets.length,
      assets,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update assets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

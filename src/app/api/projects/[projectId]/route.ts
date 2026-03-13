/**
 * API routes for a single project.
 *
 * GET    /api/projects/[projectId] — Get project with all its assets.
 * DELETE /api/projects/[projectId] — Delete project and cascade-delete assets.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { AssetRow, ProjectRow } from "@/types";

type RouteContext = { params: Promise<{ projectId: string }> };

/**
 * GET /api/projects/[projectId]
 *
 * Returns the project record together with all its assets,
 * ordered by sort_order ascending.
 */
export async function GET(_request: NextRequest, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const supabase = createServerClient();

    const { data: rawProject, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError || !rawProject) {
      const status = projectError?.code === "PGRST116" ? 404 : 500;
      return NextResponse.json(
        { error: projectError?.message ?? "Project not found" },
        { status },
      );
    }

    const project = rawProject as unknown as ProjectRow;

    const { data: rawAssets, error: assetsError } = await supabase
      .from("assets")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });

    if (assetsError) {
      return NextResponse.json(
        { error: assetsError.message },
        { status: 500 },
      );
    }

    const assets = (rawAssets ?? []) as unknown as AssetRow[];

    return NextResponse.json({ project, assets });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to get project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[projectId]
 *
 * Deletes the project. Assets are deleted first to ensure cleanup
 * even if FK cascade is not configured at the DB level.
 */
export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const supabase = createServerClient();

    // Delete assets first (safe even if FK cascade exists)
    const { error: assetsDeleteError } = await supabase
      .from("assets")
      .delete()
      .eq("project_id", projectId);

    if (assetsDeleteError) {
      return NextResponse.json(
        { error: `Failed to delete assets: ${assetsDeleteError.message}` },
        { status: 500 },
      );
    }

    const { error: projectDeleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (projectDeleteError) {
      return NextResponse.json(
        { error: projectDeleteError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

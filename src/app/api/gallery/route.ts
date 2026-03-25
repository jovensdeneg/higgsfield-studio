/**
 * GET /api/gallery?type=images|videos|all
 *
 * Returns ALL assets that have an image_url and/or video_url,
 * regardless of status. Also includes legacy scenes from Redis.
 * Unified gallery endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { listScenes } from "@/lib/store";

export interface GalleryItem {
  id: string;
  source: "project" | "scene";
  source_id: string;
  source_name: string;
  asset_code?: string;
  scene?: string;
  description: string;
  image_url: string | null;
  image1_url?: string | null;
  image2_url?: string | null;
  video_url: string | null;
  image_tool?: string;
  video_tool?: string;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type") ?? "all";
    const items: GalleryItem[] = [];
    const seenAssetIds = new Set<string>();

    const supabase = createServerClient();

    // 1. Fetch ALL assets that have image_url or video_url
    // Build query based on type filter
    let query = supabase
      .from("assets")
      .select("id, project_id, asset_code, scene, description, image_url, image1_url, image2_url, video_url, image_tool, video_tool, created_at")
      .order("created_at", { ascending: false });

    if (type === "images") {
      query = query.not("image_url", "is", null);
    } else if (type === "videos") {
      query = query.not("video_url", "is", null);
    } else {
      // "all" — assets that have either image or video
      query = query.or("image_url.not.is.null,video_url.not.is.null");
    }

    const { data: assets } = await query;

    if (assets && assets.length > 0) {
      // Fetch project names
      const projectIds = [...new Set(assets.map((a: { project_id: string }) => a.project_id))];
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds);

      const projectNames = new Map(
        (projects ?? []).map((p: { id: string; name: string }) => [p.id, p.name])
      );

      for (const asset of assets) {
        const a = asset as {
          id: string; project_id: string; asset_code: string; scene: string;
          description: string; image_url: string | null; image1_url: string | null;
          image2_url: string | null; video_url: string | null;
          image_tool: string; video_tool: string; created_at: string;
        };

        if (seenAssetIds.has(a.id)) continue;
        seenAssetIds.add(a.id);

        items.push({
          id: `proj-${a.id}`,
          source: "project",
          source_id: a.project_id,
          source_name: projectNames.get(a.project_id) ?? "Projeto",
          asset_code: a.asset_code,
          scene: a.scene,
          description: a.description,
          image_url: a.image_url ?? a.image1_url,
          image1_url: a.image1_url,
          image2_url: a.image2_url,
          video_url: a.video_url,
          image_tool: a.image_tool,
          video_tool: a.video_tool,
          created_at: a.created_at,
        });
      }
    }

    // 2. Fetch from legacy scenes (Redis)
    try {
      const scenes = await listScenes();
      for (const scene of scenes) {
        const hasImage = scene.generated_images?.length > 0;
        const hasVideo = scene.status === "completed" && scene.video_url;

        if (type === "videos" && !hasVideo) continue;
        if (type === "images" && !hasImage) continue;
        if (!hasImage && !hasVideo) continue;

        items.push({
          id: `scene-${scene.scene_id}`,
          source: "scene",
          source_id: scene.scene_id,
          source_name: scene.scene_id,
          description: scene.original_prompt,
          image_url: scene.generated_images?.[scene.approved_image_index ?? 0]?.url ?? scene.generated_images?.[0]?.url ?? null,
          video_url: scene.video_url,
          created_at: scene.created_at,
        });
      }
    } catch {
      // Redis may not be available — skip legacy scenes
    }

    // Sort alphabetically by asset_code (fallback to source_name, then id)
    items.sort((a, b) => {
      const nameA = (a.asset_code ?? a.source_name ?? a.id).toLowerCase();
      const nameB = (b.asset_code ?? b.source_name ?? b.id).toLowerCase();
      return nameA.localeCompare(nameB, "pt-BR", { numeric: true });
    });

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch gallery";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

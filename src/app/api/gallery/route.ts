/**
 * GET /api/gallery?type=images|videos|all
 *
 * Returns approved/completed assets from projects (Supabase)
 * and completed scenes from the legacy store (Redis).
 * Unified gallery endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { listScenes } from "@/lib/store";

export interface GalleryItem {
  id: string;
  source: "project" | "scene";
  source_id: string; // project_id or scene_id
  source_name: string; // project name or scene_id
  asset_code?: string;
  scene?: string;
  description: string;
  image_url: string | null;
  video_url: string | null;
  image_tool?: string;
  video_tool?: string;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type") ?? "all";
    const items: GalleryItem[] = [];

    const supabase = createServerClient();

    // 1. Fetch from Supabase projects: approved images + ready/approved videos
    if (type === "images" || type === "all") {
      const { data: imageAssets } = await supabase
        .from("assets")
        .select("id, project_id, asset_code, scene, description, image_url, video_url, image_tool, video_tool, status, created_at")
        .not("image_url", "is", null)
        .in("status", ["ready", "approved", "generating"])
        .order("created_at", { ascending: false });

      if (imageAssets) {
        // Fetch project names
        const projectIds = [...new Set(imageAssets.map((a: { project_id: string }) => a.project_id))];
        const { data: projects } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", projectIds);

        const projectNames = new Map((projects ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

        for (const asset of imageAssets) {
          const a = asset as {
            id: string; project_id: string; asset_code: string; scene: string;
            description: string; image_url: string; video_url: string | null;
            image_tool: string; video_tool: string; created_at: string;
          };
          items.push({
            id: `proj-img-${a.id}`,
            source: "project",
            source_id: a.project_id,
            source_name: projectNames.get(a.project_id) ?? "Projeto",
            asset_code: a.asset_code,
            scene: a.scene,
            description: a.description,
            image_url: a.image_url,
            video_url: a.video_url,
            image_tool: a.image_tool,
            video_tool: a.video_tool,
            created_at: a.created_at,
          });
        }
      }
    }

    if (type === "videos" || type === "all") {
      const { data: videoAssets } = await supabase
        .from("assets")
        .select("id, project_id, asset_code, scene, description, image_url, video_url, image_tool, video_tool, status, created_at")
        .not("video_url", "is", null)
        .order("created_at", { ascending: false });

      if (videoAssets) {
        const projectIds = [...new Set(videoAssets.map((a: { project_id: string }) => a.project_id))];
        const { data: projects } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", projectIds);

        const projectNames = new Map((projects ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

        for (const asset of videoAssets) {
          const a = asset as {
            id: string; project_id: string; asset_code: string; scene: string;
            description: string; image_url: string | null; video_url: string;
            image_tool: string; video_tool: string; created_at: string;
          };
          // Avoid duplicates if already added as image
          const existingId = `proj-img-${a.id}`;
          const alreadyAdded = items.some((i) => i.id === existingId);
          if (!alreadyAdded) {
            items.push({
              id: `proj-vid-${a.id}`,
              source: "project",
              source_id: a.project_id,
              source_name: projectNames.get(a.project_id) ?? "Projeto",
              asset_code: a.asset_code,
              scene: a.scene,
              description: a.description,
              image_url: a.image_url,
              video_url: a.video_url,
              image_tool: a.image_tool,
              video_tool: a.video_tool,
              created_at: a.created_at,
            });
          } else {
            // Update existing item with video_url
            const existing = items.find((i) => i.id === existingId);
            if (existing) existing.video_url = a.video_url;
          }
        }
      }
    }

    // 2. Fetch from legacy scenes (Redis)
    if (type === "videos" || type === "all") {
      try {
        const scenes = await listScenes();
        for (const scene of scenes) {
          if (scene.status === "completed" && scene.video_url) {
            items.push({
              id: `scene-${scene.scene_id}`,
              source: "scene",
              source_id: scene.scene_id,
              source_name: scene.scene_id,
              description: scene.original_prompt,
              image_url: scene.generated_images?.[0]?.url ?? null,
              video_url: scene.video_url,
              created_at: scene.created_at,
            });
          }
        }
      } catch {
        // Redis may not be available — skip legacy scenes
      }
    }

    // Sort by created_at descending
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch gallery";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

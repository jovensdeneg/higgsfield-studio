/**
 * API routes for project management.
 *
 * GET  /api/projects — List all projects with asset status counts.
 * POST /api/projects — Create a project and bulk-insert assets from CSV.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { parseCsv } from "@/lib/csv-parser";
import type {
  AssetInsert,
  AssetStatus,
  ProjectRow,
  ProjectWithStats,
} from "@/types";

const STATUS_KEYS: AssetStatus[] = [
  "pending",
  "generating",
  "ready",
  "approved",
  "rejected",
  "failed",
];

/**
 * GET /api/projects
 *
 * Returns all projects ordered by creation date (newest first),
 * each enriched with aggregated asset status counts.
 */
export async function GET() {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const projects = (data ?? []) as unknown as ProjectRow[];

    // Fetch asset counts per project in a single query
    const { data: rawAssets, error: assetsError } = await supabase
      .from("assets")
      .select("project_id, status");

    if (assetsError) {
      return NextResponse.json(
        { error: assetsError.message },
        { status: 500 },
      );
    }

    const assets = (rawAssets ?? []) as unknown as {
      project_id: string;
      status: string;
    }[];

    // Build a lookup: project_id -> status counts
    const countsMap = new Map<
      string,
      Record<AssetStatus, number> & { total: number }
    >();

    for (const asset of assets) {
      if (!countsMap.has(asset.project_id)) {
        countsMap.set(asset.project_id, {
          total: 0,
          pending: 0,
          generating: 0,
          ready: 0,
          approved: 0,
          rejected: 0,
          failed: 0,
        });
      }
      const counts = countsMap.get(asset.project_id)!;
      counts.total++;
      const status = asset.status as AssetStatus;
      if (STATUS_KEYS.includes(status)) {
        counts[status]++;
      }
    }

    const result: ProjectWithStats[] = projects.map((p) => ({
      ...p,
      asset_counts: countsMap.get(p.id) ?? {
        total: 0,
        pending: 0,
        generating: 0,
        ready: 0,
        approved: 0,
        rejected: 0,
        failed: 0,
      },
    }));

    return NextResponse.json({ projects: result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/projects
 *
 * Creates a new project and optionally bulk-inserts assets parsed from CSV.
 *
 * Request body:
 * ```json
 * {
 *   "name": "Project Name",
 *   "style_bible_url": "https://...",   // optional
 *   "csv": "asset_code,scene,..."       // optional CSV text
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, style_bible_url, csv } = body as {
      name?: string;
      style_bible_url?: string;
      csv?: string;
    };

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Field 'name' is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    // ── Create the project ──
    const insertPayload = {
      name: name.trim(),
      style_bible_url: style_bible_url ?? null,
    };

    const { data: rawProject, error: projectError } = await supabase
      .from("projects")
      .insert(insertPayload as never)
      .select()
      .single();

    if (projectError || !rawProject) {
      return NextResponse.json(
        { error: projectError?.message ?? "Failed to create project" },
        { status: 500 },
      );
    }

    const project = rawProject as unknown as ProjectRow;

    // ── Parse and insert CSV assets (if provided) ──
    let insertedCount = 0;
    let parseErrors: string[] = [];

    if (csv && typeof csv === "string" && csv.trim()) {
      const parsed = parseCsv(csv);
      parseErrors = parsed.errors;

      if (parsed.assets.length > 0) {
        const rows: AssetInsert[] = parsed.assets.map((a) => ({
          ...a,
          project_id: project.id,
        }));

        const { error: insertError, count } = await supabase
          .from("assets")
          .insert(rows as never[], { count: "exact" });

        if (insertError) {
          return NextResponse.json(
            {
              error: `Project created but asset insert failed: ${insertError.message}`,
              project,
              parse_errors: parseErrors,
            },
            { status: 500 },
          );
        }

        insertedCount = count ?? rows.length;
      }
    }

    return NextResponse.json(
      {
        project,
        assets_inserted: insertedCount,
        parse_errors: parseErrors,
      },
      { status: 201 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

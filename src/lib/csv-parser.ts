/**
 * CSV parser for the production plan spreadsheet.
 *
 * New format (preferred):
 *   asset_code; scenedescription; prompt_image1; prompt_image2; prompt_video; duration; depends_on
 *
 * Legacy format (still supported):
 *   asset_code, scene, description, asset_type, image_tool, video_tool,
 *   prompt_image, prompt_video, duration
 *
 * Returns validated AssetInsert objects ready for bulk insertion into Supabase.
 */
import Papa from "papaparse";
import type {
  AssetInsert,
  AssetType,
  CsvRow,
  GenerationTool,
} from "@/types";

// ─── Constants ──────────────────────────────────────────────────────────────

const VALID_ASSET_TYPES: AssetType[] = [
  "image_to_video",
  "motion_graphic",
  "static",
  "video_only",
];

const IMAGE_TOOL_MAP: Record<string, GenerationTool> = {
  "nano-banana-pro": "higgsfield_nano_banana",
  "flux-pro-kontext-max": "higgsfield_flux",
  flux: "higgsfield_flux",
  "seedream-v4": "higgsfield_seedream",
  "google-nano-banana": "google_nano_banana",
  "nano-banana": "google_nano_banana",
  ideogram: "ideogram",
  midjourney: "midjourney",
  hera: "hera",
  manual: "manual",
};

const VIDEO_TOOL_MAP: Record<string, GenerationTool> = {
  kling: "kling_fal",
  "kling-3.0": "higgsfield_kling",
  kling_o1: "higgsfield_kling",
  "kling-o1": "higgsfield_kling",
  dop: "higgsfield_dop",
  "dop-turbo": "higgsfield_dop",
  veo: "google_veo",
  "veo-3.1": "google_veo",
  runway: "runway",
  kling_fal: "kling_fal",
  hera: "hera",
  manual: "manual",
};

// ─── Result Type ────────────────────────────────────────────────────────────

export interface ParseResult {
  assets: Omit<AssetInsert, "project_id">[];
  errors: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapTool(
  value: string | undefined,
  map: Record<string, GenerationTool>,
): GenerationTool | null {
  if (!value || !value.trim()) return null;
  const key = value.trim().toLowerCase();
  return map[key] ?? (key as GenerationTool);
}

/**
 * Detect whether the CSV uses the new format (has prompt_image1 column)
 * or legacy format (has prompt_image column).
 */
function isNewFormat(headers: string[]): boolean {
  return headers.some((h) => h === "prompt_image1");
}

// ─── Main Parser ────────────────────────────────────────────────────────────

export function parseCsv(csvText: string): ParseResult {
  const errors: string[] = [];

  const result = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  for (const e of result.errors) {
    errors.push(`Linha ${e.row ?? "?"}: ${e.message}`);
  }

  const headers = result.meta.fields?.map((f) => f.toLowerCase()) ?? [];
  const newFormat = isNewFormat(headers);

  const assets: Omit<AssetInsert, "project_id">[] = [];
  const seenCodes = new Set<string>();

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];
    const lineNum = i + 2;

    // ── Validate asset_code (required, unique) ──
    const code = row.asset_code?.trim();
    if (!code) {
      errors.push(`Linha ${lineNum}: asset_code é obrigatório`);
      continue;
    }
    if (seenCodes.has(code)) {
      errors.push(`Linha ${lineNum}: asset_code "${code}" duplicado`);
      continue;
    }
    seenCodes.add(code);

    if (newFormat) {
      // ── NEW FORMAT: asset_code; scenedescription; prompt_image1; prompt_image2; prompt_video; duration; depends_on ──
      const params: Record<string, unknown> = {};
      if (row.duration?.trim()) {
        params.duration = row.duration.trim();
      }

      // Validate depends_on references exist in CSV
      const dependsOn = row.depends_on?.trim() || null;

      assets.push({
        asset_code: code,
        scene: code, // use asset_code as scene grouping
        description: row.scenedescription?.trim() || "",
        scenedescription: row.scenedescription?.trim() || null,
        asset_type: "image_to_video" as AssetType,
        image_tool: null,
        video_tool: null,
        prompt_image: row.prompt_image1?.trim() || null,  // legacy compat
        prompt_image1: row.prompt_image1?.trim() || null,
        prompt_image2: row.prompt_image2?.trim() || null,
        prompt_video: row.prompt_video?.trim() || null,
        parameters: params,
        depends_on: dependsOn,
        sort_order: i,
      });
    } else {
      // ── LEGACY FORMAT ──
      const assetType = row.asset_type?.trim().toLowerCase() as AssetType;
      if (!assetType || !VALID_ASSET_TYPES.includes(assetType)) {
        errors.push(
          `Linha ${lineNum} (${code}): asset_type inválido "${row.asset_type}". ` +
            `Valores aceitos: ${VALID_ASSET_TYPES.join(", ")}`,
        );
        continue;
      }

      const params: Record<string, unknown> = {};
      if (row.duration?.trim()) {
        params.duration = row.duration.trim();
      }
      if (row.notes?.trim()) {
        params.notes = row.notes.trim();
      }

      assets.push({
        asset_code: code,
        scene: row.scene?.trim() || "Sem cena",
        description: row.description?.trim() || "",
        asset_type: assetType,
        image_tool: mapTool(row.image_tool, IMAGE_TOOL_MAP),
        video_tool: mapTool(row.video_tool, VIDEO_TOOL_MAP),
        prompt_image: row.prompt_image?.trim() || null,
        prompt_image1: row.prompt_image?.trim() || null,
        prompt_video: row.prompt_video?.trim() || null,
        parameters: params,
        sort_order: i,
      });
    }
  }

  // Validate depends_on references (post-parse)
  if (newFormat) {
    for (const asset of assets) {
      if (asset.depends_on && !seenCodes.has(asset.depends_on)) {
        errors.push(
          `Asset "${asset.asset_code}": depends_on "${asset.depends_on}" não encontrado no CSV`,
        );
      }
    }
  }

  return { assets, errors };
}

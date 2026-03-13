/**
 * CSV parser for the production plan spreadsheet.
 *
 * Expected CSV columns (header row, UTF-8):
 *   asset_code, scene, description, asset_type, image_tool, video_tool,
 *   prompt_image, prompt_video, duration, notes
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

/**
 * Maps friendly CSV image tool names to the `generation_tool` DB enum.
 * Keys are lowercased for case-insensitive matching.
 */
const IMAGE_TOOL_MAP: Record<string, GenerationTool> = {
  // Higgsfield
  "nano-banana-pro": "higgsfield_nano_banana",
  "flux-pro-kontext-max": "higgsfield_flux",
  flux: "higgsfield_flux",
  "seedream-v4": "higgsfield_seedream",
  // Google
  "google-nano-banana": "google_nano_banana",
  "nano-banana": "google_nano_banana",
  // Third-party / manual
  ideogram: "ideogram",
  midjourney: "midjourney",
  hera: "hera",
  manual: "manual",
};

/**
 * Maps friendly CSV video tool names to the `generation_tool` DB enum.
 * Keys are lowercased for case-insensitive matching.
 */
const VIDEO_TOOL_MAP: Record<string, GenerationTool> = {
  // Higgsfield
  kling: "kling_fal",
  "kling-3.0": "higgsfield_kling",
  kling_o1: "higgsfield_kling",
  "kling-o1": "higgsfield_kling",
  dop: "higgsfield_dop",
  "dop-turbo": "higgsfield_dop",
  // Google
  veo: "google_veo",
  "veo-3.1": "google_veo",
  // Third-party / manual
  runway: "runway",
  kling_fal: "kling_fal",
  hera: "hera",
  manual: "manual",
};

// ─── Result Type ────────────────────────────────────────────────────────────

/** Result of parsing a production CSV. */
export interface ParseResult {
  /** Successfully parsed assets (without project_id — caller must set it). */
  assets: Omit<AssetInsert, "project_id">[];
  /** Human-readable validation errors with line numbers. */
  errors: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Look up a tool name in the given map.
 * Returns null for empty/whitespace values.
 * Returns the mapped enum value, or falls back to the raw value if it is
 * already a valid GenerationTool literal.
 */
function mapTool(
  value: string | undefined,
  map: Record<string, GenerationTool>,
): GenerationTool | null {
  if (!value || !value.trim()) return null;
  const key = value.trim().toLowerCase();
  return map[key] ?? (key as GenerationTool);
}

// ─── Main Parser ────────────────────────────────────────────────────────────

/**
 * Parse a UTF-8 CSV string into validated asset insert objects.
 *
 * @param csvText - Raw CSV text with header row.
 * @returns Parsed assets and any validation errors encountered.
 */
export function parseCsv(csvText: string): ParseResult {
  const errors: string[] = [];

  const result = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  // Collect PapaParse-level errors
  for (const e of result.errors) {
    errors.push(`Linha ${e.row ?? "?"}: ${e.message}`);
  }

  const assets: Omit<AssetInsert, "project_id">[] = [];
  const seenCodes = new Set<string>();

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];
    const lineNum = i + 2; // +2 because header is line 1

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

    // ── Validate asset_type ──
    const assetType = row.asset_type?.trim().toLowerCase() as AssetType;
    if (!assetType || !VALID_ASSET_TYPES.includes(assetType)) {
      errors.push(
        `Linha ${lineNum} (${code}): asset_type inválido "${row.asset_type}". ` +
          `Valores aceitos: ${VALID_ASSET_TYPES.join(", ")}`,
      );
      continue;
    }

    // ── Build parameters JSONB from extra columns ──
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
      prompt_video: row.prompt_video?.trim() || null,
      parameters: params,
      sort_order: i,
    });
  }

  return { assets, errors };
}

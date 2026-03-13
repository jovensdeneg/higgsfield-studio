/**
 * Database types for the Higgsfield Dashboard.
 *
 * These types mirror the Supabase schema exactly.
 * Enums are represented as TypeScript union types.
 * Each table has a Row type (full record) and an Insert type (for creation).
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

/** Status of an asset through the production pipeline. */
export type AssetStatus =
  | "pending"
  | "generating"
  | "ready"
  | "approved"
  | "rejected"
  | "failed";

/** Type of asset being produced. */
export type AssetType =
  | "image_to_video"
  | "motion_graphic"
  | "static"
  | "video_only";

/** Generation tool / provider used for image or video creation. */
export type GenerationTool =
  | "higgsfield_nano_banana"
  | "higgsfield_flux"
  | "higgsfield_seedream"
  | "higgsfield_kling"
  | "higgsfield_dop"
  | "google_nano_banana"
  | "google_veo"
  | "ideogram"
  | "flux_fal"
  | "runway"
  | "kling_fal"
  | "midjourney"
  | "hera"
  | "manual";

/** Status of a generation job (image or video). */
export type JobStatus = "queued" | "running" | "completed" | "failed";

// ─── Row Types (full DB records) ─────────────────────────────────────────────

/** A production project that groups assets together. */
export interface ProjectRow {
  id: string;
  name: string;
  style_bible_url: string | null;
  created_at: string;
  updated_at: string;
}

/** A character with reference photos. */
export interface CharacterRow {
  id: string;
  name: string;
  description: string | null;
  photo_urls: string[];
  created_at: string;
  updated_at: string;
}

/** A single production asset (image, video, or motion graphic). */
export interface AssetRow {
  id: string;
  project_id: string;
  character_id: string | null;
  asset_code: string;
  scene: string;
  description: string;
  asset_type: AssetType;
  image_tool: GenerationTool | null;
  video_tool: GenerationTool | null;
  prompt_image: string | null;
  prompt_video: string | null;
  parameters: Record<string, unknown>;
  status: AssetStatus;
  image_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  review_notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** A generation job dispatched to an external provider. */
export interface GenerationJobRow {
  id: string;
  asset_id: string;
  provider: GenerationTool;
  job_type: string;
  external_task_id: string | null;
  status_url: string | null;
  status: JobStatus;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  result_url: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
}

// ─── Insert Types (omit server-generated fields) ────────────────────────────

/** Fields required to create a new project. */
export interface ProjectInsert {
  name: string;
  style_bible_url?: string | null;
}

/** Fields required to create a new character. */
export interface CharacterInsert {
  name: string;
  description?: string | null;
  photo_urls?: string[];
}

/** Fields required to create a new asset. */
export interface AssetInsert {
  project_id: string;
  character_id?: string | null;
  asset_code: string;
  scene: string;
  description: string;
  asset_type: AssetType;
  image_tool: GenerationTool | null;
  video_tool: GenerationTool | null;
  prompt_image: string | null;
  prompt_video: string | null;
  parameters: Record<string, unknown>;
  status?: AssetStatus;
  sort_order: number;
}

/** Fields required to create a new generation job. */
export interface GenerationJobInsert {
  asset_id: string;
  provider: GenerationTool;
  job_type: string;
  external_task_id?: string | null;
  status_url?: string | null;
  status?: JobStatus;
  request_payload?: Record<string, unknown> | null;
}

// ─── CSV Parsing Types ──────────────────────────────────────────────────────

/** Raw row as it comes from the CSV file (all strings). */
export interface CsvRow {
  asset_code: string;
  scene: string;
  description: string;
  asset_type: string;
  image_tool: string;
  video_tool: string;
  prompt_image: string;
  prompt_video: string;
  duration: string;
  notes: string;
}

// ─── API Response Helpers ───────────────────────────────────────────────────

/** Project with aggregated asset status counts. */
export interface ProjectWithStats extends ProjectRow {
  asset_counts: {
    total: number;
    pending: number;
    generating: number;
    ready: number;
    approved: number;
    rejected: number;
    failed: number;
  };
}

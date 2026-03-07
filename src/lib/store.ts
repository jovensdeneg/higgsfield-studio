/**
 * Store de cenas e batches.
 *
 * Usa Upstash Redis (via @upstash/redis) quando KV_REST_API_URL está configurado.
 * Fallback para Map em memória para desenvolvimento local.
 */

import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface Scene {
  scene_id: string;
  original_prompt: string;
  optimized_prompt: string;
  model_image: string;
  generated_images: { url: string; metadata?: Record<string, unknown> }[];
  approved_image_index: number | null;
  movement_prompt: string | null;
  optimized_movement_prompt: string | null;
  video_config: {
    model: string;
    duration: number;
    resolution: string;
    preset: string | null;
    end_frame: { type: string; image_url: string } | null;
  };
  status:
    | "images_generated"
    | "approved"
    | "video_submitted"
    | "completed";
  request_id: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchJob {
  scene_id: string;
  request_id: string | null;
  prompt_sent?: string;
  model?: string;
  status: string;
  error?: string;
}

export interface Batch {
  batch_id: string;
  scenes: BatchJob[];
  total_scenes: number;
  submitted: number;
  failed: number;
  created_at: string;
  status_summary?: {
    completed: number;
    in_progress: number;
    failed: number;
    total: number;
    percent_complete: number;
  };
  last_check?: string;
}

// ---------------------------------------------------------------------------
// Redis client (lazy init)
// ---------------------------------------------------------------------------

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (url && token) {
    redis = new Redis({ url, token });
    return redis;
  }

  return null;
}

// Fallback em memória para dev local
const memoryStore = new Map<string, string>();

async function kv_get(key: string): Promise<string | null> {
  const r = getRedis();
  if (r) return r.get(key);
  return memoryStore.get(key) ?? null;
}

async function kv_set(key: string, value: string): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.set(key, value);
  } else {
    memoryStore.set(key, value);
  }
}

async function kv_del(key: string): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.del(key);
  } else {
    memoryStore.delete(key);
  }
}

async function kv_keys(pattern: string): Promise<string[]> {
  const r = getRedis();
  if (r) {
    // Upstash scan com pattern
    const keys: string[] = [];
    let cursor = 0;
    do {
      const result = await r.scan(cursor, {
        match: pattern,
        count: 100,
      });
      cursor = Number(result[0]);
      keys.push(...(result[1] as string[]));
    } while (cursor !== 0);
    return keys;
  }

  // Fallback: filtrar por prefixo no Map
  const prefix = pattern.replace("*", "");
  return Array.from(memoryStore.keys()).filter((k) => k.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Scene CRUD
// ---------------------------------------------------------------------------

export async function createScene(scene: Scene): Promise<Scene> {
  await kv_set(`scene:${scene.scene_id}`, JSON.stringify(scene));
  // Manter índice de IDs
  const ids = await getSceneIds();
  if (!ids.includes(scene.scene_id)) {
    ids.push(scene.scene_id);
    await kv_set("scene_ids", JSON.stringify(ids));
  }
  return scene;
}

export async function getScene(sceneId: string): Promise<Scene | null> {
  const raw = await kv_get(`scene:${sceneId}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as Scene);
}

export async function listScenes(): Promise<Scene[]> {
  const ids = await getSceneIds();
  const scenes: Scene[] = [];
  for (const id of ids) {
    const scene = await getScene(id);
    if (scene) scenes.push(scene);
  }
  return scenes.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function updateScene(
  sceneId: string,
  updates: Partial<Scene>
): Promise<Scene> {
  const scene = await getScene(sceneId);
  if (!scene) throw new Error(`Cena '${sceneId}' não encontrada`);

  const updated = {
    ...scene,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  await kv_set(`scene:${sceneId}`, JSON.stringify(updated));
  return updated;
}

export async function deleteScene(sceneId: string): Promise<void> {
  await kv_del(`scene:${sceneId}`);
  const ids = await getSceneIds();
  const filtered = ids.filter((id) => id !== sceneId);
  await kv_set("scene_ids", JSON.stringify(filtered));
}

export async function getApprovedScenes(): Promise<Scene[]> {
  const scenes = await listScenes();
  return scenes.filter((s) => s.status === "approved");
}

async function getSceneIds(): Promise<string[]> {
  const raw = await kv_get("scene_ids");
  if (!raw) return [];
  return typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as string[]);
}

export async function getNextSceneId(): Promise<string> {
  const ids = await getSceneIds();
  const num = ids.length + 1;
  return `cena-${String(num).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Batch CRUD
// ---------------------------------------------------------------------------

export async function saveBatch(batch: Batch): Promise<void> {
  await kv_set(`batch:${batch.batch_id}`, JSON.stringify(batch));
  // Manter lista de batch IDs
  const ids = await getBatchIds();
  if (!ids.includes(batch.batch_id)) {
    ids.push(batch.batch_id);
    await kv_set("batch_ids", JSON.stringify(ids));
  }
}

export async function getLatestBatch(): Promise<Batch | null> {
  const ids = await getBatchIds();
  if (ids.length === 0) return null;
  const lastId = ids[ids.length - 1];
  const raw = await kv_get(`batch:${lastId}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as Batch);
}

async function getBatchIds(): Promise<string[]> {
  const raw = await kv_get("batch_ids");
  if (!raw) return [];
  return typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as string[]);
}

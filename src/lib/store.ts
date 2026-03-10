/**
 * Store de cenas e batches.
 *
 * Usa Redis (via ioredis) quando REDIS_URL está configurado.
 * Suporta Redis Cloud, Upstash, ou qualquer Redis padrão.
 * Fallback para Map em memória para desenvolvimento local.
 */

import IORedis from "ioredis";

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
  reference_images: string[];
  character_id: string | null;
  movement_prompt: string | null;
  optimized_movement_prompt: string | null;
  end_frame_prompt: string | null;
  end_frame_optimized_prompt: string | null;
  end_frame_model_image: string | null;
  end_frame_generated_images: { url: string; metadata?: Record<string, unknown> }[];
  end_frame_approved_index: number | null;
  end_frame_reference_images: string[];
  video_config: {
    model: string;
    duration: number;
    resolution: string;
    preset: string | null;
    end_frame: { type: string; image_url: string } | null;
  };
  provider: "higgsfield" | "google";
  status:
    | "images_generated"
    | "approved"
    | "video_submitted"
    | "completed";
  request_id: string | null;
  video_url: string | null;
  error_message: string | null;
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

export interface CharacterPhoto {
  url: string;
  filename: string;
  uploaded_at: string;
}

export interface Character {
  character_id: string;
  name: string;
  description: string;
  photos: CharacterPhoto[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Redis client (lazy init) — supports Redis Cloud, Upstash, any standard Redis
// ---------------------------------------------------------------------------

let redis: IORedis | null = null;

function getRedis(): IORedis | null {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      redis = new IORedis(redisUrl, {
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
        lazyConnect: false,
        // TLS is handled automatically by rediss:// scheme in ioredis
      });

      redis.on("error", (err) => {
        console.error("[Store] Redis error:", err.message);
      });

      return redis;
    } catch (err) {
      console.error("[Store] Failed to initialize Redis:", err);
      return null;
    }
  }

  console.warn("[Store] No REDIS_URL found, using in-memory fallback (data will be lost on redeploy).");
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
  const scene = typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as Scene);
  const defaults = {
    reference_images: [],
    character_id: null,
    end_frame_prompt: null,
    end_frame_optimized_prompt: null,
    end_frame_model_image: null,
    end_frame_generated_images: [],
    end_frame_approved_index: null,
    end_frame_reference_images: [],
    provider: "higgsfield" as const,
    error_message: null,
  };
  return { ...defaults, ...scene };
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

// ---------------------------------------------------------------------------
// Character CRUD
// ---------------------------------------------------------------------------

export async function createCharacter(char: Character): Promise<Character> {
  await kv_set(`character:${char.character_id}`, JSON.stringify(char));
  // Manter índice de IDs
  const ids = await getCharacterIds();
  if (!ids.includes(char.character_id)) {
    ids.push(char.character_id);
    await kv_set("character_ids", JSON.stringify(ids));
  }
  return char;
}

export async function getCharacter(charId: string): Promise<Character | null> {
  const raw = await kv_get(`character:${charId}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as Character);
}

export async function listCharacters(): Promise<Character[]> {
  const ids = await getCharacterIds();
  const characters: Character[] = [];
  for (const id of ids) {
    const char = await getCharacter(id);
    if (char) characters.push(char);
  }
  return characters.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function updateCharacter(
  charId: string,
  updates: Partial<Character>
): Promise<Character> {
  const char = await getCharacter(charId);
  if (!char) throw new Error(`Character '${charId}' not found`);

  const updated = {
    ...char,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  await kv_set(`character:${charId}`, JSON.stringify(updated));
  return updated;
}

export async function deleteCharacter(charId: string): Promise<void> {
  await kv_del(`character:${charId}`);
  const ids = await getCharacterIds();
  const filtered = ids.filter((id) => id !== charId);
  await kv_set("character_ids", JSON.stringify(filtered));
}

export async function getCharacterIds(): Promise<string[]> {
  const raw = await kv_get("character_ids");
  if (!raw) return [];
  return typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as string[]);
}

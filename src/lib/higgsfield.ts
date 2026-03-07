/**
 * Cliente HTTP para a API do Higgsfield AI.
 *
 * Chama diretamente https://platform.higgsfield.ai/{endpoint}
 * usando os endpoints validados na etapa anterior.
 */

const BASE_URL = "https://platform.higgsfield.ai";

function getAuthHeaders(): Record<string, string> {
  const key = process.env.HF_API_KEY ?? "";
  const secret = process.env.HF_API_SECRET ?? "";
  return {
    Authorization: `Key ${key}:${secret}`,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

export const IMAGE_MODELS: Record<string, string> = {
  "nano-banana-pro": "nano-banana-pro",
  "flux-pro-kontext-max": "flux-pro/kontext/max/text-to-image",
  "seedream-v4": "bytedance/seedream/v4/text-to-image",
};

export const VIDEO_MODELS: Record<
  string,
  { endpoint: string; model: string }
> = {
  "kling-3.0": { endpoint: "kling", model: "kling-v2-1-master" },
  "kling-o1": { endpoint: "kling", model: "kling-v2-1" },
  "kling-2.5-turbo": { endpoint: "kling", model: "kling-v2-1" },
  "dop-turbo": { endpoint: "dop", model: "dop-turbo" },
  "dop-lite": { endpoint: "dop", model: "dop-lite" },
  "dop-preview": { endpoint: "dop", model: "dop-preview" },
};

export const CAMERA_PRESETS = [
  "Dolly In", "Dolly Out", "Dolly Left", "Dolly Right",
  "Pan Left", "Pan Right", "Tilt Up", "Tilt Down",
  "Crash Zoom In", "Crash Zoom Out", "360 Orbit",
  "Ballet Time", "FPV Drone", "Handheld",
  "Car Grip", "Snorricam", "Dutch Angle",
];

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface HFImageResult {
  url: string;
  raw: Record<string, unknown>;
}

export interface HFSubmission {
  request_id: string;
  status_url: string;
  cancel_url: string;
}

export interface HFStatus {
  request_id: string;
  status: string;
  progress?: number;
}

// ---------------------------------------------------------------------------
// Chamadas à API
// ---------------------------------------------------------------------------

async function hfPost(
  endpoint: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Higgsfield API error (${res.status}): ${text}`);
  }
  return res.json();
}

async function hfGet(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Higgsfield API error (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Gera uma imagem via subscribe (POST + poll até completar).
 */
export async function generateImage(
  prompt: string,
  model: string = "nano-banana-pro",
  referenceImages?: string[]
): Promise<HFImageResult> {
  const endpoint = IMAGE_MODELS[model] ?? IMAGE_MODELS["nano-banana-pro"];

  const args: Record<string, unknown> = {
    prompt,
    resolution: "4k",
    aspect_ratio: "16:9",
  };

  if (referenceImages?.length) {
    args.input_images = referenceImages.map((url) => ({
      type: "image_url",
      image_url: url,
    }));
  }

  // Submit
  const submitRes = await hfPost(endpoint, args);
  const requestId = submitRes.request_id as string;
  const statusUrl = submitRes.status_url as string;

  // Poll até completar
  const result = await pollUntilDone(statusUrl);

  // Extrair URL da imagem
  let imageUrl = "";
  if (result.images && Array.isArray(result.images)) {
    const first = result.images[0];
    imageUrl =
      typeof first === "string"
        ? first
        : (first as Record<string, string>)?.url ?? "";
  } else if (result.url) {
    imageUrl = result.url as string;
  } else if (result.output) {
    imageUrl = result.output as string;
  }

  return { url: imageUrl, raw: result };
}

/**
 * Submete um job de vídeo (retorna imediatamente com request_id).
 */
export async function submitVideo(opts: {
  prompt: string;
  startImageUrl: string;
  endImageUrl?: string;
  model?: string;
  duration?: number;
  preset?: string;
}): Promise<HFSubmission> {
  const modelKey = opts.model ?? "kling-3.0";
  const config = VIDEO_MODELS[modelKey] ?? VIDEO_MODELS["kling-3.0"];
  const { endpoint, model: apiModel } = config;

  let body: Record<string, unknown>;

  if (endpoint === "kling") {
    body = {
      prompt: opts.prompt,
      input_image: { type: "image_url", image_url: opts.startImageUrl },
      model: apiModel,
      duration: opts.duration ?? 5,
    };
    if (opts.endImageUrl) {
      body.end_image = { type: "image_url", image_url: opts.endImageUrl };
    }
  } else {
    // dop
    body = {
      prompt: opts.prompt,
      input_images: [{ type: "image_url", image_url: opts.startImageUrl }],
      input_images_end: opts.endImageUrl
        ? [{ type: "image_url", image_url: opts.endImageUrl }]
        : [],
      model: apiModel,
      duration: opts.duration ?? 5,
      seed: Math.floor(Math.random() * 1_000_000) + 1,
      motions: opts.preset ? [{ id: opts.preset, strength: 0.7 }] : [],
    };
  }

  const data = await hfPost(endpoint, body);

  return {
    request_id: data.request_id as string,
    status_url: data.status_url as string,
    cancel_url: data.cancel_url as string,
  };
}

/**
 * Consulta o status de um request.
 */
export async function checkStatus(requestId: string): Promise<HFStatus> {
  const url = `${BASE_URL}/requests/${requestId}/status`;
  const data = await hfGet(url);

  return {
    request_id: requestId,
    status: (data.status as string) ?? "unknown",
    progress: data.progress as number | undefined,
  };
}

/**
 * Obtém o resultado de um request completo.
 */
export async function getResult(
  requestId: string
): Promise<Record<string, unknown>> {
  const url = `${BASE_URL}/requests/${requestId}/status`;
  return hfGet(url);
}

/**
 * Faz upload de uma imagem (bytes) e retorna a URL pública.
 */
export async function uploadImage(
  data: ArrayBuffer | Blob,
  contentType: string = "image/jpeg"
): Promise<string> {
  // 1. Get upload URL
  const uploadInfo = await hfPost("files/generate-upload-url", {
    content_type: contentType,
  });
  const publicUrl = uploadInfo.public_url as string;
  const uploadUrl = uploadInfo.upload_url as string;

  // 2. Upload the file
  const blob = data instanceof Blob ? data : new Blob([data], { type: contentType });
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

  return publicUrl;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function pollUntilDone(
  statusUrl: string,
  maxAttempts = 120,
  delayMs = 2000
): Promise<Record<string, unknown>> {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await hfGet(statusUrl);
    const status = data.status as string;

    if (["completed", "nsfw", "cancelled", "failed"].includes(status)) {
      return data;
    }

    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("Timeout: request did not complete in time");
}

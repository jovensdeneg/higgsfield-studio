/**
 * Cliente para Google AI APIs (Imagen + Veo).
 *
 * Usa a mesma GOOGLE_AI_KEY do improve-prompt.
 * Imagens geradas (base64) são salvas no Vercel Blob para obter URLs.
 */

import { put } from "@vercel/blob";
import type { HFImageResult, HFSubmission, HFStatus } from "./higgsfield";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

export const GOOGLE_IMAGE_MODELS: Record<string, string> = {
  "imagen-4.0": "imagen-4.0-generate-001",
  "imagen-4.0-fast": "imagen-4.0-fast-generate-001",
};

export const GOOGLE_VIDEO_MODELS: Record<string, string> = {
  "veo-3.1": "veo-3.1-generate-preview",
  "veo-3.1-fast": "veo-3.1-fast-generate-preview",
};

export const GOOGLE_VIDEO_DURATIONS = [4, 6, 8];

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.GOOGLE_AI_KEY?.trim();
  if (!key) throw new Error("GOOGLE_AI_KEY não configurada.");
  return key;
}

// ---------------------------------------------------------------------------
// Image generation (Imagen)
// ---------------------------------------------------------------------------

export async function generateImageGoogle(
  prompt: string,
  model: string = "imagen-4.0"
): Promise<HFImageResult> {
  const apiKey = getApiKey();
  const modelId = GOOGLE_IMAGE_MODELS[model] ?? GOOGLE_IMAGE_MODELS["imagen-4.0"];

  const url = `${GEMINI_BASE}/models/${modelId}:predict`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "16:9",
        personGeneration: "allow_all",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Google Imagen error (${res.status}): ${errText}`);
  }

  const data = await res.json();

  // Extract base64 image from response
  const predictions = data.predictions ?? [];
  if (predictions.length === 0) {
    throw new Error("Google Imagen: nenhuma imagem gerada");
  }

  const base64Data = predictions[0].bytesBase64Encoded;
  const mimeType = predictions[0].mimeType ?? "image/png";

  if (!base64Data) {
    throw new Error("Google Imagen: resposta sem dados de imagem");
  }

  // Upload base64 to Vercel Blob to get a URL
  const buffer = Buffer.from(base64Data, "base64");
  const filename = `imagen/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

  const blob = await put(filename, buffer, {
    access: "public",
    contentType: mimeType,
  });

  return { url: blob.url, raw: data };
}

// ---------------------------------------------------------------------------
// Video submission (Veo)
// ---------------------------------------------------------------------------

async function imageUrlToBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = res.headers.get("content-type") ?? "image/png";
  return { data: base64, mimeType };
}

export async function submitVideoGoogle(opts: {
  prompt: string;
  startImageUrl: string;
  endImageUrl?: string;
  model?: string;
  duration?: number;
}): Promise<HFSubmission> {
  const apiKey = getApiKey();
  const modelKey = opts.model ?? "veo-3.1";
  const modelId = GOOGLE_VIDEO_MODELS[modelKey] ?? GOOGLE_VIDEO_MODELS["veo-3.1"];

  // Download start frame as base64
  const startImage = await imageUrlToBase64(opts.startImageUrl);

  // Build instance
  const instance: Record<string, unknown> = {
    prompt: opts.prompt,
    image: {
      inlineData: {
        mimeType: startImage.mimeType,
        data: startImage.data,
      },
    },
  };

  // Add last frame if provided
  if (opts.endImageUrl) {
    const endImage = await imageUrlToBase64(opts.endImageUrl);
    instance.lastFrame = {
      inlineData: {
        mimeType: endImage.mimeType,
        data: endImage.data,
      },
    };
  }

  const duration = opts.duration ?? 8;
  const resolution = duration === 8 ? "1080p" : "720p";

  const url = `${GEMINI_BASE}/models/${modelId}:predictLongRunning`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      instances: [instance],
      parameters: {
        aspectRatio: "16:9",
        resolution,
        durationSeconds: String(duration),
        personGeneration: "allow_all",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Google Veo error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const operationName = data.name as string;

  if (!operationName) {
    throw new Error("Google Veo: resposta sem operation name");
  }

  return {
    request_id: operationName,
    status_url: `${GEMINI_BASE}/${operationName}`,
    cancel_url: "",
  };
}

// ---------------------------------------------------------------------------
// Status check (Veo)
// ---------------------------------------------------------------------------

export async function checkStatusGoogle(operationName: string): Promise<HFStatus> {
  const apiKey = getApiKey();

  // operationName might already be a full path or just the operation name
  const url = operationName.startsWith("http")
    ? operationName
    : `${GEMINI_BASE}/${operationName}`;

  const res = await fetch(url, {
    headers: { "x-goog-api-key": apiKey },
  });

  if (!res.ok) {
    return {
      request_id: operationName,
      status: "failed",
    };
  }

  const data = await res.json();
  const done = data.done === true;

  let status = "in_progress";
  if (done) {
    if (data.error) {
      status = "failed";
    } else {
      status = "completed";
    }
  }

  return {
    request_id: operationName,
    status,
    progress: done ? 100 : undefined,
  };
}

// ---------------------------------------------------------------------------
// Get result (Veo)
// ---------------------------------------------------------------------------

export async function getResultGoogle(
  operationName: string
): Promise<Record<string, unknown>> {
  const apiKey = getApiKey();

  const url = operationName.startsWith("http")
    ? operationName
    : `${GEMINI_BASE}/${operationName}`;

  const res = await fetch(url, {
    headers: { "x-goog-api-key": apiKey },
  });

  if (!res.ok) {
    throw new Error(`Google Veo result error (${res.status})`);
  }

  const data = await res.json();

  // Extract video URL from response
  let videoUrl: string | null = null;
  const response = data.response as Record<string, unknown> | undefined;
  if (response) {
    const genResponse = response.generateVideoResponse as Record<string, unknown> | undefined;
    if (genResponse) {
      const samples = genResponse.generatedSamples as Array<Record<string, unknown>> | undefined;
      if (samples?.[0]) {
        const video = samples[0].video as Record<string, unknown> | undefined;
        if (video?.uri) {
          // The video URI requires the API key to download
          // Download and upload to Vercel Blob for a permanent URL
          const videoRes = await fetch(video.uri as string, {
            headers: { "x-goog-api-key": apiKey },
          });
          if (videoRes.ok) {
            const videoBuffer = await videoRes.arrayBuffer();
            const filename = `videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
            const blob = await put(filename, Buffer.from(videoBuffer), {
              access: "public",
              contentType: "video/mp4",
            });
            videoUrl = blob.url;
          }
        }
      }
    }
  }

  return {
    ...data,
    video_url: videoUrl,
  };
}

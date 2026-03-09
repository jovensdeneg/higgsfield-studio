/**
 * Cliente para Google AI APIs (Nano Banana + Veo).
 *
 * Usa a mesma GOOGLE_AI_KEY do improve-prompt.
 * Imagens geradas (base64) são salvas no Vercel Blob para obter URLs.
 *
 * Modelos de imagem (Nano Banana):
 * - Nano Banana Pro (gemini-3-pro-image-preview) — máxima qualidade, 4K
 * - Nano Banana 2 (gemini-3.1-flash-image-preview) — rápido, qualidade Pro
 * - Nano Banana (gemini-2.5-flash-image) — original, mais rápido
 */

import { put } from "@vercel/blob";
import type { HFImageResult, HFSubmission, HFStatus } from "./higgsfield";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

export const GOOGLE_IMAGE_MODELS: Record<string, string> = {
  "nano-banana-pro": "gemini-3-pro-image-preview",
  "nano-banana-2": "gemini-3.1-flash-image-preview",
  "nano-banana": "gemini-2.5-flash-image",
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
// Image generation (Nano Banana via generateContent)
// ---------------------------------------------------------------------------

/**
 * Gera imagem com Nano Banana (Gemini Image) via generateContent.
 * Suporta referências visuais como input multimodal (fotos de personagem).
 */
export async function generateImageGoogle(
  prompt: string,
  model: string = "nano-banana-pro",
  referenceImages?: string[]
): Promise<HFImageResult> {
  const apiKey = getApiKey();
  const modelId = GOOGLE_IMAGE_MODELS[model] ?? GOOGLE_IMAGE_MODELS["nano-banana-pro"];

  // Build multimodal parts
  const parts: Array<Record<string, unknown>> = [];

  // Add reference images if provided (download and convert to base64)
  if (referenceImages && referenceImages.length > 0) {
    for (const imageUrl of referenceImages.slice(0, 4)) {
      try {
        const imgData = await imageUrlToBase64(imageUrl);
        parts.push({
          inlineData: {
            mimeType: imgData.mimeType,
            data: imgData.data,
          },
        });
      } catch {
        // Skip images that fail to download
      }
    }

    // Prompt with reference context
    parts.push({
      text: `Using the reference photos above as visual reference for the person's appearance, generate a single photorealistic 16:9 image with the following description:\n\n${prompt}\n\nMaintain the person's exact facial features, skin tone, and physical characteristics from the reference photos. The output must be a single high-quality photorealistic image.`,
    });
  } else {
    // Simple text-to-image prompt
    parts.push({
      text: `Generate a single photorealistic 16:9 image with the following description:\n\n${prompt}`,
    });
  }

  const url = `${GEMINI_BASE}/models/${modelId}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Nano Banana error (${res.status}): ${errText}`);
  }

  const data = await res.json();

  // Extract generated image from response parts
  const candidates = data.candidates ?? [];
  if (candidates.length === 0) {
    throw new Error("Nano Banana: nenhum candidato na resposta");
  }

  const responseParts = candidates[0]?.content?.parts ?? [];
  let base64Data: string | null = null;
  let mimeType = "image/png";

  for (const part of responseParts) {
    if (part.inlineData?.data) {
      base64Data = part.inlineData.data;
      mimeType = part.inlineData.mimeType ?? "image/png";
      break;
    }
  }

  if (!base64Data) {
    throw new Error("Nano Banana: resposta sem dados de imagem gerada");
  }

  // Upload to Vercel Blob
  const buffer = Buffer.from(base64Data, "base64");
  const filename = `nano-banana/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

  const blob = await put(filename, buffer, {
    access: "public",
    contentType: mimeType,
  });

  return { url: blob.url, raw: { ...data, model: modelId } };
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

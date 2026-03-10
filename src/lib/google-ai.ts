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
// Modelos (com fallback chain)
// ---------------------------------------------------------------------------

export const GOOGLE_IMAGE_MODELS: Record<string, string> = {
  "nano-banana-pro": "gemini-3-pro-image-preview",
  "nano-banana-2": "gemini-3.1-flash-image-preview",
  "nano-banana": "gemini-2.5-flash-image",
};

// Fallback: se o modelo preferido falhar, tenta os outros
const IMAGE_MODEL_FALLBACKS: string[] = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
];

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
 * Tenta modelo preferido → fallback automático se falhar.
 */
export async function generateImageGoogle(
  prompt: string,
  model: string = "nano-banana-pro",
  referenceImages?: string[]
): Promise<HFImageResult> {
  const apiKey = getApiKey();
  const preferredModelId = GOOGLE_IMAGE_MODELS[model] ?? GOOGLE_IMAGE_MODELS["nano-banana-pro"];

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

  // Try preferred model, then fallbacks
  const modelsToTry = [
    preferredModelId,
    ...IMAGE_MODEL_FALLBACKS.filter((m) => m !== preferredModelId),
  ];

  let lastError = "";

  for (const modelId of modelsToTry) {
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
          imageConfig: {
            aspectRatio: "16:9",
          },
        },
      }),
    });

    if (!res.ok) {
      lastError = await res.text().catch(() => "");
      // If 404 or model not found, try next model
      if (res.status === 404 || res.status === 400) {
        console.log(`[Nano Banana] Modelo ${modelId} falhou (${res.status}), tentando próximo...`);
        continue;
      }
      throw new Error(`Nano Banana error (${res.status}) [modelo: ${modelId}]: ${lastError}`);
    }

    const data = await res.json();

    // Extract generated image from response parts
    const candidates = data.candidates ?? [];
    if (candidates.length === 0) {
      console.log(`[Nano Banana] Modelo ${modelId}: nenhum candidato, tentando próximo...`);
      lastError = "nenhum candidato na resposta";
      continue;
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
      console.log(`[Nano Banana] Modelo ${modelId}: sem imagem na resposta, tentando próximo...`);
      lastError = "resposta sem dados de imagem";
      continue;
    }

    // Upload to Vercel Blob
    try {
      const buffer = Buffer.from(base64Data, "base64");
      const filename = `nano-banana/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

      const blob = await put(filename, buffer, {
        access: "public",
        contentType: mimeType,
      });

      return { url: blob.url, raw: { ...data, model: modelId } };
    } catch (blobError) {
      const blobMsg = blobError instanceof Error ? blobError.message : String(blobError);
      if (blobMsg.includes("BLOB_READ_WRITE_TOKEN") || blobMsg.includes("token") || blobMsg.includes("unauthorized")) {
        throw new Error(
          `Vercel Blob não configurado. Crie um Blob Store no dashboard da Vercel (Storage → Create → Blob) para obter o BLOB_READ_WRITE_TOKEN. Erro: ${blobMsg}`
        );
      }
      throw new Error(`Erro ao salvar imagem no Vercel Blob: ${blobMsg}`);
    }
  }

  // All models failed
  throw new Error(
    `Nano Banana: todos os modelos falharam. Último erro: ${lastError}. Modelos tentados: ${modelsToTry.join(", ")}`
  );
}

// ---------------------------------------------------------------------------
// Video submission (Veo)
// ---------------------------------------------------------------------------

async function imageUrlToBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new Error(
        `Não foi possível baixar a imagem (${res.status}). ` +
        `URL: ${imageUrl.slice(0, 100)}... ` +
        (res.status === 403
          ? "Verifique se o Blob Store está configurado com acesso público."
          : "Verifique se a URL da imagem está acessível.")
      );
    }
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = res.headers.get("content-type") ?? "image/png";
    return { data: base64, mimeType };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Não foi possível")) throw err;
    throw new Error(
      `Erro ao baixar imagem para converter em base64: ${err instanceof Error ? err.message : String(err)}. ` +
      `URL: ${imageUrl.slice(0, 100)}...`
    );
  }
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

  // Build instance — Veo uses bytesBase64Encoded (NOT inlineData)
  const instance: Record<string, unknown> = {
    prompt: opts.prompt,
    image: {
      bytesBase64Encoded: startImage.data,
      mimeType: startImage.mimeType,
    },
  };

  // Add last frame if provided
  if (opts.endImageUrl) {
    const endImage = await imageUrlToBase64(opts.endImageUrl);
    instance.lastFrame = {
      bytesBase64Encoded: endImage.data,
      mimeType: endImage.mimeType,
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
        durationSeconds: duration,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "(sem detalhes)");
    const hint =
      res.status === 400
        ? " Verifique se o prompt e as imagens são válidos."
        : res.status === 403
          ? " Verifique se a GOOGLE_AI_KEY tem permissão para Veo."
          : res.status === 404
            ? ` Modelo ${modelId} pode não estar disponível para sua API key.`
            : "";
    throw new Error(
      `Google Veo erro (${res.status}): ${errText.slice(0, 500)}${hint}`
    );
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

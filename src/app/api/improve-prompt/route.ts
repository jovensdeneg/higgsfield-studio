import { NextRequest, NextResponse } from "next/server";

const IMAGE_SYSTEM_PROMPT = `You are an expert prompt engineer for AI image generation (Higgsfield AI platform).
The user will provide a brief scene description. Your job is to expand it into a detailed, high-quality prompt optimized for photorealistic 16:9, 4K image generation.

Include: composition details, lighting (time of day, light source, quality), camera angle and lens (e.g., 35mm, wide-angle, close-up), color palette, atmosphere/mood, artistic style references, subject details (clothing, expression, pose, skin texture), environment details (textures, materials, depth of field).

Rules:
- Output ONLY the improved prompt text, no explanations, headers or markdown
- Keep it under 300 words
- Write in English
- Be specific and visual — every word should help the AI generate a better image
- If a character name is mentioned (e.g., @Breno), keep the name reference and focus on describing the scene around them`;

const VIDEO_SYSTEM_PROMPT = `You are an expert prompt engineer for AI video generation (Kling/DOP models on Higgsfield AI platform).
The user will provide a brief description of what should happen in a 5-15 second video clip. Your job is to expand it into a detailed motion/movement prompt.

Include: subject movement (speed, direction, gestures, expressions changing), camera movement (dolly, pan, tilt, orbit, zoom — specify direction and speed), temporal flow (what happens first, then, finally), atmospheric changes (light shifts, wind, particles), pacing and rhythm (slow build, sudden action, smooth flow).

Rules:
- Output ONLY the improved prompt text, no explanations, headers or markdown
- Keep it under 200 words
- Write in English
- Focus on MOTION and CHANGE over time — static descriptions are useless for video
- Be cinematic — think like a director describing a shot`;

// ---------------------------------------------------------------------------
// Provider: Google Gemini (FREE tier — recommended)
// ---------------------------------------------------------------------------

// Models to try in order — from newest stable to oldest
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"];

async function callGeminiModel(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ ok: true; text: string; provider: string } | { ok: false; error: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let errorMessage = `Gemini ${model} error (${response.status})`;
    try {
      const errJson = JSON.parse(errText);
      errorMessage = errJson.error?.message ?? errorMessage;
    } catch { /* use default */ }
    return { ok: false, error: errorMessage };
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) {
    return { ok: false, error: `Gemini ${model} returned empty response` };
  }
  return { ok: true, text, provider: model };
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ ok: true; text: string; provider: string } | { ok: false; error: string }> {
  const errors: string[] = [];
  for (const model of GEMINI_MODELS) {
    console.log(`Trying Gemini model: ${model}`);
    const result = await callGeminiModel(apiKey, model, systemPrompt, userPrompt);
    if (result.ok) return result;
    console.error(`Gemini ${model} failed:`, result.error);
    errors.push(result.error);
    // If 403/401 (bad key), skip remaining models
    if (result.error.includes("401") || result.error.includes("403")) break;
  }
  return { ok: false, error: errors.join(" | ") };
}

// ---------------------------------------------------------------------------
// Provider: OpenAI (requires billing)
// ---------------------------------------------------------------------------

const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ ok: true; text: string; provider: string } | { ok: false; status: number; error: string }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_completion_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let errorMessage = `OpenAI ${model} error (${response.status})`;
    try {
      const errJson = JSON.parse(errText);
      errorMessage = errJson.error?.message ?? errorMessage;
    } catch { /* use default */ }
    return { ok: false, status: response.status, error: errorMessage };
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    return { ok: false, status: 200, error: "OpenAI returned empty response" };
  }
  return { ok: true, text, provider: `openai-${model}` };
}

// ---------------------------------------------------------------------------
// Try all available providers in order: Gemini (free) → OpenAI (paid)
// ---------------------------------------------------------------------------

async function tryAllProviders(
  systemPrompt: string,
  userPrompt: string
): Promise<
  | { ok: true; text: string; provider: string }
  | { ok: false; errors: string[] }
> {
  const errors: string[] = [];

  // 1. Try Google Gemini first (free tier, no billing needed)
  const geminiKey = process.env.GOOGLE_AI_KEY;
  if (geminiKey) {
    console.log("Trying Google Gemini (free tier)...");
    const result = await callGemini(geminiKey.trim(), systemPrompt, userPrompt);
    if (result.ok) {
      return result;
    }
    console.error("Gemini failed:", result.error);
    errors.push(`Gemini: ${result.error}`);
  }

  // 2. Try OpenAI models (requires billing)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    for (const model of OPENAI_MODELS) {
      console.log(`Trying OpenAI ${model}...`);
      const result = await callOpenAI(openaiKey.trim(), model, systemPrompt, userPrompt);

      if (result.ok) {
        return result;
      }

      console.error(`OpenAI ${model} failed:`, result.error);
      errors.push(`${model}: ${result.error}`);

      // If 401 (bad key) or 429/quota, skip remaining OpenAI models
      if (result.status === 401 || result.status === 429) {
        break;
      }
    }
  }

  // No providers configured at all
  if (!geminiKey && !openaiKey) {
    errors.push(
      "Nenhuma chave de IA configurada. Adicione GOOGLE_AI_KEY (gratuito) ou OPENAI_API_KEY nas variaveis de ambiente da Vercel."
    );
  }

  return { ok: false, errors };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { prompt, context } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    if (context !== "image" && context !== "video") {
      return NextResponse.json(
        { error: 'context must be "image" or "video"' },
        { status: 400 }
      );
    }

    const systemPrompt = context === "image" ? IMAGE_SYSTEM_PROMPT : VIDEO_SYSTEM_PROMPT;

    const result = await tryAllProviders(systemPrompt, prompt);

    if (result.ok) {
      return NextResponse.json({
        improved_prompt: result.text,
        model_used: result.provider,
      });
    }

    // Build helpful error message
    const allErrors = result.errors.join(" | ");
    const isQuotaError = allErrors.includes("quota") || allErrors.includes("exceeded");

    // Show which providers were attempted for debugging
    const geminiConfigured = !!process.env.GOOGLE_AI_KEY;
    const openaiConfigured = !!process.env.OPENAI_API_KEY;
    const providersInfo = `[Gemini: ${geminiConfigured ? "configurado" : "nao encontrado"}, OpenAI: ${openaiConfigured ? "configurado" : "nao encontrado"}]`;

    let userMessage = `Falha ao melhorar prompt ${providersInfo}: ${allErrors}`;
    if (!geminiConfigured && isQuotaError) {
      userMessage =
        `GOOGLE_AI_KEY nao encontrada nas variaveis de ambiente. ` +
        `Verifique se o nome esta exatamente "GOOGLE_AI_KEY" (sem espacos) e faca um Redeploy. ` +
        `Gere a chave gratuita em: https://aistudio.google.com/app/apikey`;
    } else if (geminiConfigured && isQuotaError) {
      userMessage =
        `Gemini configurado mas falhou: ${allErrors}. Verifique se a chave GOOGLE_AI_KEY esta correta.`;
    }

    return NextResponse.json({ error: userMessage }, { status: 502 });
  } catch (err) {
    console.error("Improve prompt error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to improve prompt" },
      { status: 500 }
    );
  }
}

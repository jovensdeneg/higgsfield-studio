/**
 * POST /api/generate-image
 *
 * Generates a single image using the specified provider and model.
 * Body: { prompt: string, provider: "higgsfield" | "google" | "runway", model?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/higgsfield";
import { generateImageGoogle, generateImageImagen4 } from "@/lib/google-ai";
import { generateImageRunway } from "@/lib/runway";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, provider, model } = body as {
      prompt: string;
      provider?: "higgsfield" | "google" | "runway" | "imagen4";
      model?: string;
    };

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Campo 'prompt' é obrigatório" },
        { status: 400 }
      );
    }

    const useProvider = provider ?? "higgsfield";
    let imageUrl: string;

    if (useProvider === "imagen4") {
      const result = await generateImageImagen4(prompt.trim(), model ?? "imagen-4");
      imageUrl = result.url;
    } else if (useProvider === "runway") {
      const result = await generateImageRunway(prompt.trim(), model ?? "gen4_image_turbo");
      imageUrl = result.url;
    } else if (useProvider === "google") {
      const result = await generateImageGoogle(prompt.trim(), model ?? "nano-banana-pro");
      imageUrl = result.url;
    } else {
      const result = await generateImage(prompt.trim(), model ?? "nano-banana-pro");
      imageUrl = result.url;
    }

    return NextResponse.json({ url: imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao gerar imagem";

    let displayError = message;
    if (message.includes("Not enough credits")) {
      displayError = "Sem créditos. Tente outro provider.";
    } else if (message.includes("503")) {
      displayError = "Servidor sobrecarregado. Tente novamente em alguns minutos.";
    }

    return NextResponse.json({ error: displayError }, { status: 500 });
  }
}

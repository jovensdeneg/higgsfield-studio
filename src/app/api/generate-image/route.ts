/**
 * POST /api/generate-image
 *
 * Generates a single image using the specified provider and model.
 * Saves the result to Supabase so it appears in the gallery.
 * Body: { prompt: string, provider: "higgsfield" | "google" | "runway", model?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/higgsfield";
import { generateImageGoogle, generateImageImagen4 } from "@/lib/google-ai";
import { generateImageRunway } from "@/lib/runway";
import { createServerClient } from "@/lib/supabase/server";

/** Ensure a "gallery" project exists for standalone generations. */
async function getGalleryProjectId(
  supabase: ReturnType<typeof createServerClient>,
): Promise<string> {
  const GALLERY_NAME = "Imagem Direta";
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("name", GALLERY_NAME)
    .limit(1)
    .single();

  if (data) return (data as { id: string }).id;

  const { data: created } = await supabase
    .from("projects")
    .insert({ name: GALLERY_NAME })
    .select("id")
    .single();

  return (created as { id: string }).id;
}

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

    // Save to gallery (Supabase assets table)
    try {
      const supabase = createServerClient();
      const projectId = await getGalleryProjectId(supabase);
      const code = `IMG-${Date.now().toString(36).toUpperCase()}`;
      await supabase.from("assets").insert({
        project_id: projectId,
        asset_code: code,
        scene: "Imagem Direta",
        description: prompt.trim().slice(0, 200),
        asset_type: "static" as const,
        image_url: imageUrl,
        image1_url: imageUrl,
        prompt_image: prompt.trim(),
        prompt_image1: prompt.trim(),
        status: "ready" as const,
        sort_order: 0,
      });
    } catch {
      // Don't fail the request if gallery save fails
      console.error("[generate-image] Failed to save to gallery");
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

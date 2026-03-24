/**
 * POST /api/dispatch/images
 *
 * Dispatches image generation for ONE asset at a time.
 * Supports dual-image mode: generates image1 (frame inicial), then image2
 * (frame final) using image1 as reference for visual consistency.
 *
 * Body:
 *   { assetId: string, provider?: string, model?: string, imageNumber?: 1 | 2 }
 *
 * imageNumber:
 *   1 = generate image1 (frame inicial) — default
 *   2 = generate image2 (frame final), using image1 as reference
 *
 * For scenes with depends_on: approved images from parent scene are also
 * sent as reference images for visual continuity.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateImage } from "@/lib/higgsfield";
import { generateImageGoogle, generateImageImagen4 } from "@/lib/google-ai";
import { generateImageRunway } from "@/lib/runway";
import type {
  AssetRow,
  GenerationTool,
  GenerationJobInsert,
} from "@/types";

// Maps GenerationTool enum to provider + model
const IMAGE_TOOL_MAP: Record<
  string,
  { provider: "higgsfield" | "google" | "runway"; model: string }
> = {
  higgsfield_nano_banana: { provider: "higgsfield", model: "nano-banana-pro" },
  higgsfield_flux: { provider: "higgsfield", model: "flux-pro-kontext-max" },
  higgsfield_seedream: { provider: "higgsfield", model: "seedream-v4" },
  google_nano_banana: { provider: "google", model: "nano-banana-pro" },
  runway: { provider: "runway", model: "gen4_image_turbo" },
  ideogram: { provider: "higgsfield", model: "nano-banana-pro" },
  flux_fal: { provider: "higgsfield", model: "flux-pro-kontext-max" },
  midjourney: { provider: "higgsfield", model: "nano-banana-pro" },
};

const MANUAL_TOOLS = new Set(["hera", "manual"]);

/**
 * Collect reference images from parent scenes (depends_on chain).
 * Returns URLs of approved images from parent scene(s).
 */
async function collectDependencyReferences(
  supabase: ReturnType<typeof createServerClient>,
  asset: AssetRow,
  projectId: string,
): Promise<string[]> {
  if (!asset.depends_on) return [];

  const refs: string[] = [];

  // Fetch parent asset by asset_code within the same project
  const { data } = await supabase
    .from("assets")
    .select("*")
    .eq("project_id", projectId)
    .eq("asset_code", asset.depends_on)
    .single();

  if (!data) return refs;

  const parent = data as unknown as AssetRow;

  // Add parent's approved images as references
  const img1 = parent.image1_url ?? parent.image_url;
  const img2 = parent.image2_url;
  if (img1) refs.push(img1);
  if (img2) refs.push(img2);

  // Recurse up the dependency chain (parent's parent)
  if (parent.depends_on) {
    const parentRefs = await collectDependencyReferences(supabase, parent, projectId);
    refs.push(...parentRefs);
  }

  // Limit to 10 references (Nano Banana Pro supports up to 14)
  return refs.slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      assetId: singleId,
      assetIds,
      provider: overrideProvider,
      model: overrideModel,
      imageNumber = 1,
    } = body as {
      assetId?: string;
      assetIds?: string[];
      provider?: "higgsfield" | "google" | "runway" | "imagen4";
      model?: string;
      imageNumber?: 1 | 2;
    };

    const targetId = singleId ?? assetIds?.[0];

    if (!targetId) {
      return NextResponse.json(
        { error: "'assetId' is required" },
        { status: 400 },
      );
    }

    const remaining = assetIds ? assetIds.filter((id) => id !== targetId) : [];
    const supabase = createServerClient();

    // 1. Fetch the asset
    const { data: assetData, error: fetchError } = await supabase
      .from("assets")
      .select("*")
      .eq("id", targetId)
      .single();

    if (fetchError || !assetData) {
      return NextResponse.json(
        { error: `Asset not found: ${fetchError?.message ?? targetId}` },
        { status: 404 },
      );
    }

    const asset = assetData as unknown as AssetRow;

    // 2. Determine which prompt to use
    const prompt =
      imageNumber === 2
        ? (asset.prompt_image2 ?? null)
        : (asset.prompt_image1 ?? asset.prompt_image ?? null);

    if (!prompt) {
      return NextResponse.json({
        status: "skipped",
        assetId: asset.id,
        reason: `No prompt_image${imageNumber}`,
        remaining,
      });
    }

    // For image1: asset must be "pending" or "generating" (if image2 dispatch)
    // For image2: asset should already have image1 generated
    if (imageNumber === 1 && asset.status !== "pending") {
      return NextResponse.json({
        status: "skipped",
        assetId: asset.id,
        reason: `Status is '${asset.status}', expected 'pending'`,
        remaining,
      });
    }

    if (imageNumber === 2) {
      const img1 = asset.image1_url ?? asset.image_url;
      if (!img1) {
        return NextResponse.json({
          status: "skipped",
          assetId: asset.id,
          reason: "Image1 must be generated before image2",
          remaining,
        });
      }
    }

    // 3. Determine provider and model
    const toolKey = asset.image_tool as string | null;
    const mapping = toolKey ? IMAGE_TOOL_MAP[toolKey] : null;

    let provider: "higgsfield" | "google" | "runway" | "imagen4";
    let model: string;

    if (overrideProvider) {
      provider = overrideProvider;
      model = overrideModel ?? (
        provider === "runway" ? "gen4_image_turbo" :
        provider === "imagen4" ? "imagen-4" :
        mapping?.model ?? "nano-banana-pro"
      );
    } else if (mapping) {
      provider = mapping.provider;
      model = overrideModel ?? mapping.model;
    } else if (toolKey && MANUAL_TOOLS.has(toolKey)) {
      return NextResponse.json({
        status: "skipped",
        assetId: asset.id,
        reason: `Manual tool: ${toolKey}`,
        remaining,
      });
    } else {
      provider = "higgsfield";
      model = overrideModel ?? "nano-banana-pro";
    }

    // 4. Build reference images array
    let referenceImages: string[] = [];

    // 4a. For image2: ALWAYS include image1 as reference
    if (imageNumber === 2) {
      const img1 = asset.image1_url ?? asset.image_url;
      if (img1) referenceImages.push(img1);
    }

    // 4b. For scenes with depends_on: include parent scene's approved images
    if (asset.depends_on) {
      const depRefs = await collectDependencyReferences(supabase, asset, asset.project_id);
      referenceImages.push(...depRefs);
    }

    // 4c. Character reference images (legacy support)
    if (asset.character_id) {
      const { data: charData } = await supabase
        .from("characters")
        .select("photo_urls")
        .eq("id", asset.character_id)
        .single();

      if (charData && Array.isArray(charData.photo_urls) && charData.photo_urls.length > 0) {
        referenceImages.push(...(charData.photo_urls as string[]));
      }
    }

    // Deduplicate and limit
    referenceImages = [...new Set(referenceImages)].slice(0, 12);

    // 4d. If references are needed but provider doesn't support them,
    //     auto-switch to Google (Nano Banana Pro) which supports up to 14
    if (referenceImages.length > 0 && (provider === "imagen4" || provider === "runway")) {
      console.log(
        `[dispatch/images] Provider ${provider} não suporta referências visuais. ` +
        `Switching to Google (Nano Banana Pro) para manter consistência visual.`
      );
      provider = "google";
      model = "nano-banana-pro";
    }

    // 5. Update status to "generating"
    await supabase
      .from("assets")
      .update({ status: "generating" })
      .eq("id", asset.id);

    // 6. Create generation_job record
    const jobInsert: GenerationJobInsert = {
      asset_id: asset.id,
      provider: (toolKey ?? `${provider}_nano_banana`) as GenerationTool,
      job_type: imageNumber === 2 ? "image2" : "image",
      status: "running",
      request_payload: {
        prompt,
        model,
        provider,
        imageNumber,
        reference_images: referenceImages,
      },
    };

    const { data: jobData, error: jobError } = await supabase
      .from("generation_jobs")
      .insert(jobInsert)
      .select()
      .single();

    if (jobError) {
      await supabase
        .from("assets")
        .update({ status: "failed" })
        .eq("id", asset.id);
      return NextResponse.json(
        { error: `Failed to create job: ${jobError.message}`, remaining },
        { status: 500 },
      );
    }

    const jobId = (jobData as { id: string }).id;

    // 7. Call the provider
    try {
      let imageUrl: string;

      if (provider === "imagen4") {
        const result = await generateImageImagen4(prompt, model);
        imageUrl = result.url;
      } else if (provider === "runway") {
        const result = await generateImageRunway(prompt, model, referenceImages.length > 0 ? referenceImages : undefined);
        imageUrl = result.url;
      } else if (provider === "google") {
        const result = await generateImageGoogle(prompt, model, referenceImages.length > 0 ? referenceImages : undefined);
        imageUrl = result.url;
      } else {
        const result = await generateImage(prompt, model, referenceImages.length > 0 ? referenceImages : undefined);
        imageUrl = result.url;
      }

      // 8. Save result — update the correct URL column
      const updateFields: Record<string, unknown> = {};
      if (imageNumber === 2) {
        updateFields.image2_url = imageUrl;
        // Both images done → mark as "ready"
        updateFields.status = "ready";
      } else {
        updateFields.image_url = imageUrl;
        updateFields.image1_url = imageUrl;
        // If there's a prompt_image2, stay in "generating" (image2 still needed)
        // If not, mark as "ready"
        updateFields.status = asset.prompt_image2 ? "generating" : "ready";
      }

      await supabase
        .from("assets")
        .update(updateFields)
        .eq("id", asset.id);

      await supabase
        .from("generation_jobs")
        .update({
          status: "completed",
          result_url: imageUrl,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return NextResponse.json({
        status: "completed",
        assetId: asset.id,
        imageNumber,
        url: imageUrl,
        // Signal to frontend whether image2 still needs generation
        needsImage2: imageNumber === 1 && !!asset.prompt_image2,
        remaining,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      let displayError = errorMessage;
      if (errorMessage.includes("Not enough credits")) {
        displayError = "Sem creditos no Higgsfield. Tente com Google AI.";
      } else if (errorMessage.includes("503")) {
        displayError = "Servidor sobrecarregado. Tente novamente em alguns minutos.";
      }

      await supabase
        .from("assets")
        .update({ status: "failed", error_message: displayError.slice(0, 500) })
        .eq("id", asset.id);

      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_message: errorMessage.slice(0, 2000),
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return NextResponse.json({
        status: "failed",
        assetId: asset.id,
        imageNumber,
        error: errorMessage,
        remaining,
      });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to dispatch image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

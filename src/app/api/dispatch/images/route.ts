/**
 * POST /api/dispatch/images
 *
 * Dispatches image generation for ONE asset at a time.
 * The frontend should call this endpoint repeatedly for each asset in sequence.
 * This avoids Vercel's 60s function timeout on the Hobby plan.
 *
 * Body: { assetId: string, provider?: "higgsfield" | "google", model?: string }
 *
 * Legacy support: also accepts { assetIds: string[] } — will process only the FIRST one.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateImage } from "@/lib/higgsfield";
import { generateImageGoogle } from "@/lib/google-ai";
import type {
  AssetRow,
  GenerationTool,
  GenerationJobInsert,
} from "@/types";

// Maps GenerationTool enum to provider + model
const IMAGE_TOOL_MAP: Record<
  string,
  { provider: "higgsfield" | "google"; model: string }
> = {
  higgsfield_nano_banana: { provider: "higgsfield", model: "nano-banana-pro" },
  higgsfield_flux: { provider: "higgsfield", model: "flux-pro-kontext-max" },
  higgsfield_seedream: { provider: "higgsfield", model: "seedream-v4" },
  google_nano_banana: { provider: "google", model: "nano-banana-pro" },
  // Unmapped tools → route to Higgsfield as default
  ideogram: { provider: "higgsfield", model: "nano-banana-pro" },
  flux_fal: { provider: "higgsfield", model: "flux-pro-kontext-max" },
  midjourney: { provider: "higgsfield", model: "nano-banana-pro" },
};

// Tools that are manual / not dispatchable (require external generation)
const MANUAL_TOOLS = new Set(["hera", "manual"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      assetId: singleId,
      assetIds,
      provider: overrideProvider,
      model: overrideModel,
    } = body as {
      assetId?: string;
      assetIds?: string[];
      provider?: "higgsfield" | "google";
      model?: string;
    };

    // Accept assetId (preferred) or first element of assetIds (legacy)
    const targetId = singleId ?? assetIds?.[0];

    if (!targetId) {
      return NextResponse.json(
        { error: "'assetId' is required" },
        { status: 400 },
      );
    }

    // If caller sent multiple IDs, return the remaining so the frontend knows what's left
    const remaining = assetIds ? assetIds.filter((id) => id !== targetId) : [];

    const supabase = createServerClient();

    // 1. Fetch the single asset
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

    // 2. Validate status
    if (asset.status !== "pending") {
      return NextResponse.json({
        status: "skipped",
        assetId: asset.id,
        reason: `Status is '${asset.status}', expected 'pending'`,
        remaining,
      });
    }

    if (!asset.prompt_image) {
      return NextResponse.json({
        status: "skipped",
        assetId: asset.id,
        reason: "No prompt_image",
        remaining,
      });
    }

    // 3. Determine provider and model
    const toolKey = asset.image_tool as string | null;
    const mapping = toolKey ? IMAGE_TOOL_MAP[toolKey] : null;

    let provider: "higgsfield" | "google";
    let model: string;

    if (overrideProvider) {
      provider = overrideProvider;
      model = overrideModel ?? mapping?.model ?? "nano-banana-pro";
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

    // 4. Get character reference images if applicable
    let referenceImages: string[] | undefined;
    if (asset.character_id) {
      const { data: charData } = await supabase
        .from("characters")
        .select("photo_urls")
        .eq("id", asset.character_id)
        .single();

      if (charData && Array.isArray(charData.photo_urls) && charData.photo_urls.length > 0) {
        referenceImages = charData.photo_urls as string[];
      }
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
      job_type: "image",
      status: "running",
      request_payload: {
        prompt: asset.prompt_image,
        model,
        provider,
        reference_images: referenceImages ?? [],
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

    // 7. Call the provider (single asset — fits within Vercel 60s timeout)
    try {
      let imageUrl: string;

      if (provider === "google") {
        const result = await generateImageGoogle(
          asset.prompt_image!,
          model,
          referenceImages,
        );
        imageUrl = result.url;
      } else {
        const result = await generateImage(
          asset.prompt_image!,
          model,
          referenceImages,
        );
        imageUrl = result.url;
      }

      // Success: update asset and job
      await supabase
        .from("assets")
        .update({ image_url: imageUrl, status: "ready" })
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
        url: imageUrl,
        remaining,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Simplify error for user display
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

/**
 * POST /api/dispatch/images
 *
 * Dispatches image generation for a batch of assets.
 * Processes sequentially with a 2s delay between requests to respect rate limits.
 *
 * Body: { assetIds: string[], provider?: "higgsfield" | "google", model?: string }
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

const DELAY_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      assetIds,
      provider: overrideProvider,
      model: overrideModel,
    } = body as {
      assetIds?: string[];
      provider?: "higgsfield" | "google";
      model?: string;
    };

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json(
        { error: "'assetIds' must be a non-empty array of UUIDs" },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    // 1. Fetch assets
    const { data: assetsData, error: fetchError } = await supabase
      .from("assets")
      .select("*")
      .in("id", assetIds);

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch assets: ${fetchError.message}` },
        { status: 500 },
      );
    }

    const assets = (assetsData ?? []) as unknown as AssetRow[];

    // 2. Filter to only pending assets with a prompt
    const eligible = assets.filter(
      (a) => a.status === "pending" && a.prompt_image,
    );
    const skipped = assets.length - eligible.length;

    // 3. Process each asset sequentially
    const results: Array<{
      assetId: string;
      status: "completed" | "failed" | "skipped";
      url?: string;
      error?: string;
    }> = [];

    let dispatched = 0;
    let failed = 0;

    for (let i = 0; i < eligible.length; i++) {
      const asset = eligible[i];

      // Determine provider and model
      const toolKey = asset.image_tool as string | null;
      const mapping = toolKey ? IMAGE_TOOL_MAP[toolKey] : null;

      let provider: "higgsfield" | "google";
      let model: string;

      if (overrideProvider) {
        provider = overrideProvider;
        model =
          overrideModel ??
          mapping?.model ??
          "nano-banana-pro";
      } else if (mapping) {
        provider = mapping.provider;
        model = overrideModel ?? mapping.model;
      } else if (toolKey && MANUAL_TOOLS.has(toolKey)) {
        results.push({
          assetId: asset.id,
          status: "skipped",
          error: `Manual tool: ${toolKey}`,
        });
        continue;
      } else {
        // Default to Higgsfield
        provider = "higgsfield";
        model = overrideModel ?? "nano-banana-pro";
      }

      // Get character reference images if applicable
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

      // a. Update status to "generating"
      await supabase
        .from("assets")
        .update({ status: "generating" })
        .eq("id", asset.id);

      // b. Create generation_job record
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
        results.push({
          assetId: asset.id,
          status: "failed",
          error: `Failed to create job: ${jobError.message}`,
        });
        await supabase
          .from("assets")
          .update({ status: "failed" })
          .eq("id", asset.id);
        failed++;
        continue;
      }

      const jobId = (jobData as { id: string }).id;

      // c. Call the provider
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

        // d. Success: update asset and job
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

        results.push({
          assetId: asset.id,
          status: "completed",
          url: imageUrl,
        });
        dispatched++;
      } catch (err) {
        // e. Failure: update asset and job
        const errorMessage =
          err instanceof Error ? err.message : String(err);

        await supabase
          .from("assets")
          .update({ status: "failed" })
          .eq("id", asset.id);

        await supabase
          .from("generation_jobs")
          .update({
            status: "failed",
            error_message: errorMessage.slice(0, 2000),
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        results.push({
          assetId: asset.id,
          status: "failed",
          error: errorMessage,
        });
        failed++;
      }

      // Delay between requests (skip after last)
      if (i < eligible.length - 1) {
        await delay(DELAY_MS);
      }
    }

    return NextResponse.json({
      dispatched,
      skipped: skipped + results.filter((r) => r.status === "skipped").length,
      failed,
      results,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to dispatch images";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

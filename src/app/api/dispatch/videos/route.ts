/**
 * POST /api/dispatch/videos
 *
 * Dispatches video generation for ONE asset at a time.
 * The frontend should call this endpoint repeatedly for each asset in sequence.
 * This avoids Vercel's 60s function timeout on the Hobby plan.
 *
 * Body: { assetId: string, provider?: "higgsfield" | "google" | "runway", model?: string }
 *
 * Legacy support: also accepts { assetIds: string[] } — will process only the FIRST one.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { submitVideo } from "@/lib/higgsfield";
import { submitVideoGoogle } from "@/lib/google-ai";
import { submitVideoRunway } from "@/lib/runway";
import type {
  AssetRow,
  GenerationTool,
  GenerationJobInsert,
} from "@/types";

// Maps GenerationTool enum to provider + default video model
const VIDEO_TOOL_MAP: Record<
  string,
  { provider: "higgsfield" | "google" | "runway"; model: string }
> = {
  higgsfield_kling: { provider: "higgsfield", model: "kling-3.0" },
  higgsfield_dop: { provider: "higgsfield", model: "dop-turbo" },
  google_veo: { provider: "google", model: "veo-3.1" },
  runway: { provider: "runway", model: "gen4.5" },
  kling_fal: { provider: "higgsfield", model: "kling-3.0" },
};

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
      provider?: "higgsfield" | "google" | "runway";
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
        { error: `Asset not found: ${fetchError?.message ?? targetId}`, remaining },
        { status: 404 },
      );
    }

    const asset = assetData as unknown as AssetRow;

    // 2. Validate status
    if (asset.status !== "approved") {
      return NextResponse.json({
        status: "skipped",
        assetId: asset.id,
        reason: `Status is '${asset.status}', expected 'approved'`,
        remaining,
      });
    }

    if (!asset.image_url) {
      return NextResponse.json({
        status: "skipped",
        assetId: asset.id,
        reason: "No image_url",
        remaining,
      });
    }

    // 3. Determine provider and model
    const toolKey = asset.video_tool as string | null;
    const mapping = toolKey ? VIDEO_TOOL_MAP[toolKey] : null;

    let provider: "higgsfield" | "google" | "runway";
    let model: string;

    if (overrideProvider) {
      provider = overrideProvider;
      model = overrideModel ?? (provider === "runway" ? "gen4.5" : mapping?.model ?? "kling-3.0");
    } else if (mapping) {
      provider = mapping.provider;
      model = overrideModel ?? mapping.model;
    } else {
      provider = "higgsfield";
      model = overrideModel ?? "kling-3.0";
    }

    // 4. Compute duration
    const rawDuration = (asset.parameters as Record<string, unknown>)?.duration;
    const parsedDuration = rawDuration ? Number(rawDuration) : 5;

    let duration: number;
    if (provider === "runway") {
      duration = Math.max(2, Math.min(10, Math.round(parsedDuration)));
    } else {
      const VALID_DURATIONS = [5, 10];
      duration = VALID_DURATIONS.reduce((prev, curr) =>
        Math.abs(curr - parsedDuration) < Math.abs(prev - parsedDuration) ? curr : prev
      );
    }

    const prompt = asset.prompt_video ?? asset.description;
    const preset = (asset.parameters as Record<string, unknown>)?.preset as string | undefined;

    // 5. Update status to "generating"
    await supabase
      .from("assets")
      .update({ status: "generating" })
      .eq("id", asset.id);

    // 6. Create generation_job
    const jobInsert: GenerationJobInsert = {
      asset_id: asset.id,
      provider: (toolKey ?? `${provider}_kling`) as GenerationTool,
      job_type: "video",
      status: "running",
      request_payload: {
        prompt,
        start_image_url: asset.image_url,
        model,
        provider,
        duration,
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
        .update({ status: "failed", error_message: "Erro ao criar job" })
        .eq("id", asset.id);
      return NextResponse.json(
        { error: `Failed to create job: ${jobError.message}`, remaining },
        { status: 500 },
      );
    }

    const jobId = (jobData as { id: string }).id;

    // 7. Submit to provider
    try {
      let submission: { request_id: string; status_url: string };

      if (provider === "runway") {
        submission = await submitVideoRunway({
          prompt,
          startImageUrl: asset.image_url!,
          model,
          duration,
        });
      } else if (provider === "google") {
        submission = await submitVideoGoogle({
          prompt,
          startImageUrl: asset.image_url!,
          model,
          duration,
        });
      } else {
        submission = await submitVideo({
          prompt,
          startImageUrl: asset.image_url!,
          model,
          duration,
          preset,
        });
      }

      // Store external task ID
      await supabase
        .from("generation_jobs")
        .update({
          external_task_id: submission.request_id,
          status_url: submission.status_url,
          response_payload: submission as unknown as Record<string, unknown>,
        })
        .eq("id", jobId);

      return NextResponse.json({
        status: "submitted",
        assetId: asset.id,
        jobId,
        externalId: submission.request_id,
        remaining,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_message: errorMessage.slice(0, 2000),
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      let displayError = errorMessage;
      if (errorMessage.includes("Not enough credits")) {
        displayError = "Sem creditos. Tente outro provider.";
      } else if (errorMessage.includes("too_big")) {
        displayError = "Prompt muito longo para este provider.";
      }

      await supabase
        .from("assets")
        .update({ status: "failed", error_message: displayError.slice(0, 500) })
        .eq("id", asset.id);

      return NextResponse.json({
        status: "failed",
        assetId: asset.id,
        error: displayError,
        noCredits: errorMessage.includes("Not enough credits"),
        remaining,
      });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to dispatch video";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/dispatch/videos
 *
 * Dispatches video generation for approved assets that have an image_url.
 * Video generation is async -- this route submits the jobs and stores
 * external task IDs for later polling via /api/jobs/poll.
 *
 * Body: { assetIds: string[], provider?: "higgsfield" | "google", model?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { submitVideo } from "@/lib/higgsfield";
import { submitVideoGoogle } from "@/lib/google-ai";
import type {
  AssetRow,
  GenerationTool,
  GenerationJobInsert,
} from "@/types";

// Maps GenerationTool enum to provider + default video model
const VIDEO_TOOL_MAP: Record<
  string,
  { provider: "higgsfield" | "google"; model: string }
> = {
  higgsfield_kling: { provider: "higgsfield", model: "kling-3.0" },
  higgsfield_dop: { provider: "higgsfield", model: "dop-turbo" },
  google_veo: { provider: "google", model: "veo-3.1" },
  // Unmapped tools → route to Higgsfield Kling as default
  runway: { provider: "higgsfield", model: "kling-3.0" },
  kling_fal: { provider: "higgsfield", model: "kling-3.0" },
};

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

    // 1. Fetch assets -- must have status "approved" AND image_url
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
    const eligible = assets.filter(
      (a) => a.status === "approved" && a.image_url,
    );

    const jobs: Array<{
      assetId: string;
      jobId: string;
      externalId: string;
    }> = [];
    const errors: Array<{ assetId: string; error: string }> = [];

    for (const asset of eligible) {
      const toolKey = asset.video_tool as string | null;
      const mapping = toolKey ? VIDEO_TOOL_MAP[toolKey] : null;

      let provider: "higgsfield" | "google";
      let model: string;

      if (overrideProvider) {
        provider = overrideProvider;
        model = overrideModel ?? mapping?.model ?? "kling-3.0";
      } else if (mapping) {
        provider = mapping.provider;
        model = overrideModel ?? mapping.model;
      } else {
        // Default to Higgsfield Kling
        provider = "higgsfield";
        model = overrideModel ?? "kling-3.0";
      }

      // Compute duration and prompt early (used in both job insert and submission)
      const rawDuration = (asset.parameters as Record<string, unknown>)?.duration;
      const parsedDuration = rawDuration ? Number(rawDuration) : 5;
      // Higgsfield Kling only accepts [5, 10]; snap to nearest valid value
      const VALID_DURATIONS = [5, 10];
      const duration = VALID_DURATIONS.reduce((prev, curr) =>
        Math.abs(curr - parsedDuration) < Math.abs(prev - parsedDuration) ? curr : prev
      );
      const prompt = asset.prompt_video ?? asset.description;
      const preset = (asset.parameters as Record<string, unknown>)?.preset as string | undefined;

      // a. Update status to "generating"
      await supabase
        .from("assets")
        .update({ status: "generating" })
        .eq("id", asset.id);

      // b. Create generation_job
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
        errors.push({
          assetId: asset.id,
          error: `Failed to create job: ${jobError.message}`,
        });
        await supabase
          .from("assets")
          .update({ status: "failed" })
          .eq("id", asset.id);
        continue;
      }

      const jobId = (jobData as { id: string }).id;

      // c. Submit to provider (async -- don't poll)
      try {
        let submission: {
          request_id: string;
          status_url: string;
        };

        if (provider === "google") {
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

        // d. Store external task ID and status URL in the job
        await supabase
          .from("generation_jobs")
          .update({
            external_task_id: submission.request_id,
            status_url: submission.status_url,
            response_payload: submission as unknown as Record<string, unknown>,
          })
          .eq("id", jobId);

        jobs.push({
          assetId: asset.id,
          jobId,
          externalId: submission.request_id,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);

        await supabase
          .from("generation_jobs")
          .update({
            status: "failed",
            error_message: errorMessage.slice(0, 2000),
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        await supabase
          .from("assets")
          .update({ status: "failed" })
          .eq("id", asset.id);

        errors.push({ assetId: asset.id, error: errorMessage });
      }
    }

    return NextResponse.json({
      dispatched: jobs.length,
      failed: errors.length,
      skipped: assets.length - eligible.length,
      jobs,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to dispatch videos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

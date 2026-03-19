/**
 * Runway AI provider — Gen 4.5 image generation and video generation.
 *
 * Uses the official @runwayml/sdk package.
 * Auth: RUNWAYML_API_SECRET env var.
 *
 * Models:
 *   Video: gen4.5 (best), gen4_turbo, gen3a_turbo
 *   Image: gen4_image_turbo, gen4_image
 *
 * Duration: 2-10 seconds (integer)
 * Ratios: 1280:720, 720:1280, 1104:832, 960:960, 832:1104, 1584:672
 */
import RunwayML, { TaskFailedError } from "@runwayml/sdk";

// ---------------------------------------------------------------------------
// Client (lazy singleton)
// ---------------------------------------------------------------------------

let _client: RunwayML | null = null;

function getClient(): RunwayML {
  if (_client) return _client;
  const apiKey = process.env.RUNWAYML_API_SECRET;
  if (!apiKey) throw new Error("RUNWAYML_API_SECRET is not set");
  _client = new RunwayML({ apiKey });
  return _client;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunwayVideoSubmission {
  request_id: string;
  status_url: string;
}

export interface RunwayVideoResult {
  status: "completed" | "failed" | "running" | "pending";
  progress?: number;
  video_url?: string;
  error?: string;
}

export interface RunwayImageResult {
  url: string;
  raw?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Image Generation (sync — waits for completion)
// ---------------------------------------------------------------------------

export async function generateImageRunway(
  prompt: string,
  model: string = "gen4_image_turbo",
  referenceImages?: string[],
): Promise<RunwayImageResult> {
  const client = getClient();

  // Runway text-to-image uses textToImage endpoint
  // If reference image provided, append to prompt context
  const enhancedPrompt = referenceImages?.length
    ? `${prompt} (visual reference style from provided images)`
    : prompt;

  const task = await (client as unknown as {
    textToImage: {
      create: (opts: Record<string, unknown>) => {
        waitForTaskOutput: () => Promise<Record<string, unknown>>;
      };
    };
  }).textToImage.create({
    model: model || "gen4_image_turbo",
    promptText: enhancedPrompt,
    ratio: "1280:720",
  }).waitForTaskOutput();

  const output = task.output as string[] | undefined;
  if (!output || output.length === 0) {
    throw new Error("Runway image generation returned no output");
  }

  return { url: output[0], raw: task as Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Video Generation — Submit (async, returns task ID for polling)
// ---------------------------------------------------------------------------

export async function submitVideoRunway(opts: {
  prompt: string;
  startImageUrl: string;
  model?: string;
  duration?: number;
  ratio?: string;
}): Promise<RunwayVideoSubmission> {
  const client = getClient();

  const model = opts.model || "gen4.5";
  // Duration must be integer 2-10
  const rawDuration = opts.duration ?? 5;
  const duration = Math.max(2, Math.min(10, Math.round(rawDuration)));
  const ratio = opts.ratio || "1280:720";

  const task = await client.imageToVideo.create({
    model: model as "gen4.5",
    promptImage: opts.startImageUrl,
    promptText: opts.prompt,
    ratio: ratio as "1280:720",
    duration,
  });

  const taskId = task.id;

  return {
    request_id: taskId,
    status_url: `https://api.dev.runwayml.com/v1/tasks/${taskId}`,
  };
}

// ---------------------------------------------------------------------------
// Video Generation — Sync (waits for completion, used for short videos)
// ---------------------------------------------------------------------------

export async function generateVideoRunway(opts: {
  prompt: string;
  startImageUrl: string;
  model?: string;
  duration?: number;
  ratio?: string;
}): Promise<{ video_url: string; raw: Record<string, unknown> }> {
  const client = getClient();

  const model = opts.model || "gen4.5";
  const rawDuration = opts.duration ?? 5;
  const duration = Math.max(2, Math.min(10, Math.round(rawDuration)));
  const ratio = opts.ratio || "1280:720";

  try {
    const task = await client.imageToVideo.create({
      model: model as "gen4.5",
      promptImage: opts.startImageUrl,
      promptText: opts.prompt,
      ratio: ratio as "1280:720",
      duration,
    }).waitForTaskOutput();

    const output = task.output as string[] | undefined;
    if (!output || output.length === 0) {
      throw new Error("Runway video generation returned no output");
    }

    return { video_url: output[0], raw: task as unknown as Record<string, unknown> };
  } catch (err) {
    if (err instanceof TaskFailedError) {
      throw new Error(`Runway video failed: ${JSON.stringify(err.taskDetails)}`);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Poll Status
// ---------------------------------------------------------------------------

export async function checkStatusRunway(
  taskId: string,
): Promise<{ status: string; progress?: number }> {
  const client = getClient();

  const task = await client.tasks.retrieve(taskId);

  const statusMap: Record<string, string> = {
    SUCCEEDED: "completed",
    FAILED: "failed",
    PENDING: "pending",
    THROTTLED: "pending",
    RUNNING: "running",
  };

  return {
    status: statusMap[task.status] ?? "running",
    progress: task.status === "RUNNING" ? (task.progress ?? undefined) : undefined,
  };
}

export async function getResultRunway(
  taskId: string,
): Promise<Record<string, unknown>> {
  const client = getClient();

  const task = await client.tasks.retrieve(taskId);

  if (task.status !== "SUCCEEDED") {
    throw new Error(`Task ${taskId} is not completed (status: ${task.status})`);
  }

  const output = task.output as string[] | undefined;

  return {
    status: "completed",
    video_url: output?.[0] ?? null,
    output,
    raw: task,
  };
}

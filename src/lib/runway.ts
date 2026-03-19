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

const RUNWAY_MAX_PROMPT = 1000;

/**
 * Uses Google Gemini to intelligently condense a video prompt to fit
 * within Runway's 1000-char limit, preserving essential details.
 */
async function condensePrompt(prompt: string): Promise<string> {
  if (prompt.length <= RUNWAY_MAX_PROMPT) return prompt;

  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) {
    // Fallback to simple truncation if no Google key
    return prompt.slice(0, RUNWAY_MAX_PROMPT - 3) + "...";
  }

  const systemPrompt = `You are a video prompt optimizer. Condense the following video generation prompt to UNDER 950 characters while preserving ALL essential details: camera movement, subject actions, timing, mood, lighting, and style. Remove redundancy and verbose descriptions. Keep it as a single paragraph. Output ONLY the condensed prompt, nothing else.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 400, temperature: 0.3 },
        }),
      },
    );

    if (!res.ok) {
      console.error("[Runway] Gemini condense failed:", res.status);
      return prompt.slice(0, RUNWAY_MAX_PROMPT - 3) + "...";
    }

    const data = await res.json();
    const condensed =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    if (condensed.length > 0 && condensed.length <= RUNWAY_MAX_PROMPT) {
      return condensed;
    }

    // If Gemini output is still too long, truncate it
    if (condensed.length > RUNWAY_MAX_PROMPT) {
      return condensed.slice(0, RUNWAY_MAX_PROMPT - 3) + "...";
    }

    return prompt.slice(0, RUNWAY_MAX_PROMPT - 3) + "...";
  } catch (err) {
    console.error("[Runway] Gemini condense error:", err);
    return prompt.slice(0, RUNWAY_MAX_PROMPT - 3) + "...";
  }
}

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
  // Runway limits promptText to 1000 chars — use Gemini to condense if needed
  const promptText = await condensePrompt(opts.prompt);

  const task = await client.imageToVideo.create({
    model: model as "gen4.5",
    promptImage: opts.startImageUrl,
    promptText,
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
  // Runway limits promptText to 1000 chars — use Gemini to condense if needed
  const promptText = await condensePrompt(opts.prompt);

  try {
    const task = await client.imageToVideo.create({
      model: model as "gen4.5",
      promptImage: opts.startImageUrl,
      promptText,
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

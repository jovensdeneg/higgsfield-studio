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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const systemPrompt = context === "image" ? IMAGE_SYSTEM_PROMPT : VIDEO_SYSTEM_PROMPT;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("OpenAI error:", errData);
      return NextResponse.json(
        { error: "Failed to improve prompt" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const improvedPrompt = data.choices?.[0]?.message?.content?.trim() ?? prompt;

    return NextResponse.json({ improved_prompt: improvedPrompt });
  } catch (err) {
    console.error("Improve prompt error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to improve prompt" },
      { status: 500 }
    );
  }
}

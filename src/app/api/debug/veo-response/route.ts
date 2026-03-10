import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/debug/veo-response?operation=models/veo-3.1-generate-preview/operations/xxx
 *
 * Debug endpoint to inspect raw Veo API response structure.
 * Returns the full JSON response from the operation status check.
 */
export async function GET(request: NextRequest) {
  try {
    const operation = request.nextUrl.searchParams.get("operation");
    if (!operation) {
      return NextResponse.json(
        { error: "Missing 'operation' query parameter" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_AI_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_AI_KEY not configured" },
        { status: 500 }
      );
    }

    const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
    const url = operation.startsWith("http")
      ? operation
      : `${GEMINI_BASE}/${operation}`;

    const res = await fetch(url, {
      headers: { "x-goog-api-key": apiKey },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Fetch failed (${res.status})`, body: errText },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Return structured debug info
    const debug: Record<string, unknown> = {
      _topLevelKeys: Object.keys(data),
      done: data.done,
      name: data.name,
    };

    // Inspect response structure
    if (data.response) {
      debug._responseKeys = Object.keys(data.response);
      debug._responseType = data.response["@type"] ?? null;

      if (data.response.generateVideoResponse) {
        debug._genVideoResponseKeys = Object.keys(data.response.generateVideoResponse);
        const samples = data.response.generateVideoResponse.generatedSamples;
        if (samples?.[0]) {
          debug._sample0Keys = Object.keys(samples[0]);
          if (samples[0].video) {
            debug._videoKeys = Object.keys(samples[0].video);
            debug._videoUri = samples[0].video.uri ?? null;
            debug._hasBase64 = !!samples[0].video.bytesBase64Encoded;
            debug._videoMimeType = samples[0].video.mimeType ?? null;
          }
        }
        debug._samplesCount = samples?.length ?? 0;
      }

      // Check if generatedSamples is directly on response (without generateVideoResponse wrapper)
      if (data.response.generatedSamples) {
        debug._directSamples = true;
        debug._directSamplesCount = data.response.generatedSamples.length;
        const s0 = data.response.generatedSamples[0];
        if (s0) {
          debug._directSample0Keys = Object.keys(s0);
          if (s0.video) {
            debug._directVideoKeys = Object.keys(s0.video);
            debug._directVideoUri = s0.video.uri ?? null;
          }
        }
      }
    }

    // Check error field
    if (data.error) {
      debug._error = data.error;
    }

    // Return full raw response (truncate large base64 fields)
    const rawStr = JSON.stringify(data);
    debug._rawResponseLength = rawStr.length;
    // Truncate base64 data for readability
    const truncated = rawStr.replace(
      /"(bytesBase64Encoded|data)":\s*"[A-Za-z0-9+/=]{100,}"/g,
      '"$1": "[BASE64_TRUNCATED]"'
    );
    debug._rawResponse = JSON.parse(truncated);

    return NextResponse.json(debug);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

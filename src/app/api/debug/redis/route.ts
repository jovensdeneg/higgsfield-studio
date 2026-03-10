import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

function parseRedisUrl(redisUrl: string): { url: string; token: string; host: string } | null {
  try {
    const parsed = new URL(redisUrl);
    const host = parsed.hostname;
    const token = decodeURIComponent(parsed.password);
    if (host && token) {
      return { url: `https://${host}`, token, host };
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

/**
 * GET /api/debug/redis
 * Quick diagnostic — shows env vars and parsed values, tests connection with timeout.
 */
export async function GET() {
  const envVars = {
    KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    REDIS_URL: !!process.env.REDIS_URL,
  };

  // Show what REDIS_URL looks like (masked)
  let redisUrlInfo: string | null = null;
  let parsedInfo: Record<string, string> | null = null;

  if (process.env.REDIS_URL) {
    const raw = process.env.REDIS_URL;
    // Mask the token: show first 8 chars + "..."
    redisUrlInfo = raw.replace(/:([^@]{8})[^@]*@/, ":$1...@");

    const parsed = parseRedisUrl(raw);
    if (parsed) {
      parsedInfo = {
        restUrl: parsed.url,
        host: parsed.host,
        tokenLength: String(parsed.token.length),
        tokenPrefix: parsed.token.slice(0, 8) + "...",
      };
    }
  }

  // Try explicit REST vars first
  let url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  let token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  let source = "explicit";

  // Fallback: parse REDIS_URL
  if ((!url || !token) && process.env.REDIS_URL) {
    const parsed = parseRedisUrl(process.env.REDIS_URL);
    if (parsed) {
      url = parsed.url;
      token = parsed.token;
      source = "parsed from REDIS_URL";
    }
  }

  if (!url || !token) {
    return NextResponse.json({
      connected: false,
      reason: "No credentials resolved",
      envVars,
      redisUrlInfo,
      parsedInfo,
    });
  }

  // Test connection with 5s timeout
  try {
    const redis = new Redis({ url, token });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const pong = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new Error("Connection timeout (5s)"))
        );
      }),
    ]);

    clearTimeout(timeout);

    return NextResponse.json({
      connected: true,
      source,
      pong,
      envVars,
      redisUrlInfo,
      parsedInfo,
      resolvedUrl: url.slice(0, 50),
    });
  } catch (err) {
    return NextResponse.json({
      connected: false,
      source,
      reason: err instanceof Error ? err.message : String(err),
      envVars,
      redisUrlInfo,
      parsedInfo,
      resolvedUrl: url.slice(0, 50),
    });
  }
}

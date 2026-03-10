import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

function parseRedisUrl(redisUrl: string): { url: string; token: string } | null {
  try {
    const parsed = new URL(redisUrl);
    const host = parsed.hostname;
    const token = parsed.password;
    if (host && token) {
      return { url: `https://${host}`, token };
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

/**
 * GET /api/debug/redis
 * Check if Redis is connected and show which env vars are available.
 */
export async function GET() {
  const envVars = {
    KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    REDIS_URL: !!process.env.REDIS_URL,
  };

  // Try explicit REST vars
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
      reason: "No Redis credentials found",
      envVars,
    });
  }

  try {
    const redis = new Redis({ url, token });
    const pong = await redis.ping();
    return NextResponse.json({
      connected: true,
      source,
      pong,
      envVars,
      restUrl: url.slice(0, 40) + "...",
    });
  } catch (err) {
    return NextResponse.json({
      connected: false,
      source,
      reason: err instanceof Error ? err.message : String(err),
      envVars,
    });
  }
}

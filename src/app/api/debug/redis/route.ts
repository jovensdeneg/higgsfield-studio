import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

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
    REDIS_REST_API_URL: !!process.env.REDIS_REST_API_URL,
    REDIS_REST_API_TOKEN: !!process.env.REDIS_REST_API_TOKEN,
    REDIS_URL: !!process.env.REDIS_URL,
    REDIS_TOKEN: !!process.env.REDIS_TOKEN,
  };

  const url =
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.REDIS_REST_API_URL ??
    process.env.REDIS_URL;
  const token =
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.REDIS_REST_API_TOKEN ??
    process.env.REDIS_TOKEN;

  if (!url || !token) {
    return NextResponse.json({
      connected: false,
      reason: "No Redis credentials found",
      envVars,
    });
  }

  try {
    const redis = new Redis({ url, token });
    await redis.ping();
    return NextResponse.json({
      connected: true,
      envVars,
      urlPrefix: url.slice(0, 30) + "...",
    });
  } catch (err) {
    return NextResponse.json({
      connected: false,
      reason: err instanceof Error ? err.message : String(err),
      envVars,
    });
  }
}

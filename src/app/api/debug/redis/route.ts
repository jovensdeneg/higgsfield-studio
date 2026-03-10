import { NextResponse } from "next/server";
import IORedis from "ioredis";

/**
 * GET /api/debug/redis
 * Quick diagnostic — tests Redis connection via ioredis.
 */
export async function GET() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return NextResponse.json({
      connected: false,
      reason: "REDIS_URL not set",
    });
  }

  // Mask URL for display
  const masked = redisUrl.replace(/:([^@]{6})[^@]*@/, ":$1...@");

  let client: IORedis | null = null;
  try {
    client = new IORedis(redisUrl, {
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    await client.connect();
    const pong = await client.ping();

    return NextResponse.json({
      connected: true,
      pong,
      redisUrl: masked,
    });
  } catch (err) {
    return NextResponse.json({
      connected: false,
      reason: err instanceof Error ? err.message : String(err),
      redisUrl: masked,
    });
  } finally {
    if (client) {
      client.disconnect();
    }
  }
}

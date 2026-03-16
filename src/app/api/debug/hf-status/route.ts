/**
 * DEBUG: Fetch raw Higgsfield status response.
 * GET /api/debug/hf-status?id=<request_id>
 */
import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://platform.higgsfield.ai";

export async function GET(request: NextRequest) {
  const requestId = request.nextUrl.searchParams.get("id");
  if (!requestId) {
    return NextResponse.json({ error: "Missing ?id= parameter" }, { status: 400 });
  }

  const key = process.env.HF_API_KEY ?? "";
  const secret = process.env.HF_API_SECRET ?? "";

  const url = `${BASE_URL}/requests/${requestId}/status`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Key ${key}:${secret}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  return NextResponse.json({ raw: data, httpStatus: res.status });
}

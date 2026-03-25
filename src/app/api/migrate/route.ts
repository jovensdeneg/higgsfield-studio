/**
 * POST /api/migrate
 * One-time migration endpoint. Run once then delete this file.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "No Supabase credentials" }, { status: 500 });
    }

    // Use the management/postgres connection via supabase-js rpc
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Try adding columns one by one (idempotent — IF NOT EXISTS equivalent via catch)
    const columns = [
      { name: "prompt_image1", type: "text" },
      { name: "prompt_image2", type: "text" },
      { name: "image1_url", type: "text" },
      { name: "image2_url", type: "text" },
      { name: "depends_on", type: "text" },
      { name: "scenedescription", type: "text" },
    ];

    const results: string[] = [];

    for (const col of columns) {
      // Test if column exists by selecting it
      const { error: testErr } = await supabase
        .from("assets")
        .select(col.name)
        .limit(1);

      if (testErr && testErr.message.includes(col.name)) {
        // Column doesn't exist — we can't ALTER TABLE via PostgREST
        results.push(`${col.name}: needs manual creation (PostgREST can't ALTER TABLE)`);
      } else {
        results.push(`${col.name}: already exists`);
      }
    }

    // Copy data from old columns to new ones where applicable
    // This works because we're using UPDATE which PostgREST supports

    // First check if prompt_image1 column exists and has null values where prompt_image has data
    const { data: needsCopy } = await supabase
      .from("assets")
      .select("id, prompt_image, image_url")
      .is("prompt_image1", null)
      .not("prompt_image", "is", null)
      .limit(100);

    if (needsCopy && needsCopy.length > 0) {
      for (const row of needsCopy) {
        const r = row as { id: string; prompt_image: string; image_url: string | null };
        await supabase
          .from("assets")
          .update({
            prompt_image1: r.prompt_image,
            image1_url: r.image_url,
          })
          .eq("id", r.id);
      }
      results.push(`Copied prompt_image → prompt_image1 for ${needsCopy.length} assets`);
    }

    // Copy description → scenedescription
    const { data: needsDesc } = await supabase
      .from("assets")
      .select("id, description")
      .is("scenedescription", null)
      .not("description", "is", null)
      .limit(100);

    if (needsDesc && needsDesc.length > 0) {
      for (const row of needsDesc) {
        const r = row as { id: string; description: string };
        await supabase
          .from("assets")
          .update({ scenedescription: r.description })
          .eq("id", r.id);
      }
      results.push(`Copied description → scenedescription for ${needsDesc.length} assets`);
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createCharacter, listCharacters, type Character } from "@/lib/store";

export async function GET() {
  try {
    const characters = await listCharacters();
    return NextResponse.json({ characters });
  } catch (err) {
    console.error("List characters error:", err);
    return NextResponse.json({ error: "Failed to list characters" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const charId = "char-" + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    const now = new Date().toISOString();

    const character: Character = {
      character_id: charId,
      name: name.trim(),
      description: description?.trim() || "",
      photos: [],
      created_at: now,
      updated_at: now,
    };

    await createCharacter(character);
    return NextResponse.json({ character }, { status: 201 });
  } catch (err) {
    console.error("Create character error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create character" },
      { status: 500 }
    );
  }
}

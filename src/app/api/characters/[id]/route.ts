import { NextRequest, NextResponse } from "next/server";
import { getCharacter, deleteCharacter } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const character = await getCharacter(id);
    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }
    return NextResponse.json({ character });
  } catch (err) {
    console.error("Get character error:", err);
    return NextResponse.json({ error: "Failed to get character" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteCharacter(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete character error:", err);
    return NextResponse.json({ error: "Failed to delete character" }, { status: 500 });
  }
}

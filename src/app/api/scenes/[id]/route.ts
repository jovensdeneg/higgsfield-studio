import { NextRequest, NextResponse } from "next/server";
import { getScene, deleteScene } from "@/lib/store";

/**
 * GET /api/scenes/[id]
 * Retrieve a single scene by its ID.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scene = await getScene(id);

    if (!scene) {
      return NextResponse.json(
        { error: `Scene '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ scene });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get scene";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/scenes/[id]
 * Delete a scene by its ID.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scene = await getScene(id);

    if (!scene) {
      return NextResponse.json(
        { error: `Scene '${id}' not found` },
        { status: 404 }
      );
    }

    await deleteScene(id);
    return NextResponse.json({ deleted: id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete scene";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

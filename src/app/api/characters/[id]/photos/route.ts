import { NextRequest, NextResponse } from "next/server";
import { getCharacter, updateCharacter } from "@/lib/store";
import { uploadImage } from "@/lib/higgsfield";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const character = await getCharacter(id);
    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll("photos") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No photos provided" }, { status: 400 });
    }

    const newPhotos = [];
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const url = await uploadImage(buffer, file.type || "image/jpeg");
      newPhotos.push({
        url,
        filename: file.name,
        uploaded_at: new Date().toISOString(),
      });
    }

    const updated = await updateCharacter(id, {
      photos: [...character.photos, ...newPhotos],
    });

    return NextResponse.json({ character: updated }, { status: 201 });
  } catch (err) {
    console.error("Upload photos error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload photos" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const character = await getCharacter(id);
    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    const { photo_index } = await request.json();
    if (typeof photo_index !== "number" || photo_index < 0 || photo_index >= character.photos.length) {
      return NextResponse.json({ error: "Invalid photo_index" }, { status: 400 });
    }

    const photos = [...character.photos];
    photos.splice(photo_index, 1);
    const updated = await updateCharacter(id, { photos });

    return NextResponse.json({ character: updated });
  } catch (err) {
    console.error("Delete photo error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete photo" },
      { status: 500 }
    );
  }
}

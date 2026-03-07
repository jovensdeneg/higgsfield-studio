"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import PhotoUploadZone from "@/components/PhotoUploadZone";

interface CharacterPhoto {
  url: string;
  filename: string;
  uploaded_at: string;
}

interface Character {
  character_id: string;
  name: string;
  description: string;
  photos: CharacterPhoto[];
  created_at: string;
}

export default function CharacterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchCharacter = useCallback(async () => {
    try {
      const res = await fetch(`/api/characters/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCharacter(data.character);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchCharacter(); }, [fetchCharacter]);

  async function handleDeletePhoto(index: number) {
    if (deleting !== null) return;
    setDeleting(index);
    try {
      const res = await fetch(`/api/characters/${id}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_index: index }),
      });
      if (res.ok) {
        fetchCharacter();
      }
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  }

  async function handleDeleteCharacter() {
    if (!confirm(`Tem certeza que deseja excluir "${character?.name}"?`)) return;
    try {
      await fetch(`/api/characters/${id}`, { method: "DELETE" });
      router.push("/characters");
    } catch { alert("Erro ao excluir personagem"); }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
          <p className="text-sm text-slate-400">Carregando personagem...</p>
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-slate-400">Personagem não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{character.name}</h1>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
              {character.photos.length} foto{character.photos.length !== 1 ? "s" : ""}
            </span>
          </div>
          {character.description && (
            <p className="mt-1 text-sm text-slate-400">{character.description}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Use <code className="rounded bg-slate-800 px-1 py-0.5 text-emerald-400">@{character.name}</code> no prompt para incluir este personagem
          </p>
        </div>
        <button
          onClick={handleDeleteCharacter}
          className="rounded-lg border border-red-800 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/20"
        >
          Excluir Personagem
        </button>
      </div>

      {/* Upload Zone */}
      <PhotoUploadZone characterId={id} onUploadComplete={fetchCharacter} />

      {/* Photos Grid */}
      {character.photos.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">Fotos de Referência</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {character.photos.map((photo, i) => (
              <div key={i} className="group relative overflow-hidden rounded-xl border border-slate-800">
                <div className="aspect-square">
                  <img src={photo.url} alt={photo.filename} className="h-full w-full object-cover" />
                </div>
                <button
                  onClick={() => handleDeletePhoto(i)}
                  disabled={deleting !== null}
                  className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-red-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/90 disabled:opacity-50"
                >
                  {deleting === i ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-800 border-t-red-400" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6">
                  <p className="truncate text-[10px] text-slate-300">{photo.filename}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

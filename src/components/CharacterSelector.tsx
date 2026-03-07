"use client";

import { useEffect, useState } from "react";

interface CharacterPhoto {
  url: string;
  filename: string;
}

interface Character {
  character_id: string;
  name: string;
  photos: CharacterPhoto[];
}

interface CharacterSelectorProps {
  selectedId: string | null;
  onSelect: (characterId: string | null) => void;
  disabled?: boolean;
}

export default function CharacterSelector({ selectedId, onSelect, disabled }: CharacterSelectorProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/characters")
      .then((r) => r.json())
      .then((d) => setCharacters(d.characters ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selected = characters.find((c) => c.character_id === selectedId);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-400">Personagem (opcional)</label>
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
        disabled={disabled || loading}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
      >
        <option value="">Nenhum personagem</option>
        {characters.map((c) => (
          <option key={c.character_id} value={c.character_id}>
            {c.name} ({c.photos.length} fotos)
          </option>
        ))}
      </select>

      {/* Photo preview */}
      {selected && selected.photos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.photos.slice(0, 8).map((photo, i) => (
            <div key={i} className="h-10 w-10 overflow-hidden rounded border border-slate-700">
              <img src={photo.url} alt={photo.filename} className="h-full w-full object-cover" />
            </div>
          ))}
          {selected.photos.length > 8 && (
            <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-700 bg-slate-800 text-[10px] text-slate-400">
              +{selected.photos.length - 8}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

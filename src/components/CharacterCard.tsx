"use client";

import Link from "next/link";

interface CharacterCardProps {
  character: {
    character_id: string;
    name: string;
    description: string;
    photos: { url: string }[];
  };
}

export default function CharacterCard({ character }: CharacterCardProps) {
  const thumbnail = character.photos[0]?.url;

  return (
    <Link
      href={`/characters/${character.character_id}`}
      className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition-all hover:border-slate-700 hover:shadow-lg hover:shadow-black/20"
    >
      {/* Thumbnail grid */}
      <div className="grid h-40 grid-cols-2 gap-0.5 overflow-hidden bg-slate-800">
        {character.photos.slice(0, 4).map((photo, i) => (
          <div key={i} className="overflow-hidden">
            <img
              src={photo.url}
              alt={`${character.name} ${i + 1}`}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        ))}
        {character.photos.length === 0 && (
          <div className="col-span-2 flex items-center justify-center">
            <svg className="h-10 w-10 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-white">{character.name}</h3>
        <p className="mt-1 text-xs text-slate-400">
          {character.photos.length} foto{character.photos.length !== 1 ? "s" : ""}
        </p>
        {character.description && (
          <p className="mt-1 truncate text-xs text-slate-500">{character.description}</p>
        )}
      </div>
    </Link>
  );
}

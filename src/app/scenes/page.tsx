"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SceneCard from "@/components/SceneCard";

interface Scene {
  scene_id: string;
  status: string;
  original_prompt: string;
  generated_images: { url: string }[];
  video_url?: string;
  approved_image_index?: number | null;
  created_at: string;
}

const FILTERS = [
  { value: "all", label: "Todas" },
  { value: "images_generated", label: "Imagens Geradas" },
  { value: "approved", label: "Aprovadas" },
  { value: "video_submitted", label: "Video Enviado" },
  { value: "completed", label: "Completas" },
];

export default function ScenesPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/scenes")
      .then((r) => r.json())
      .then((data) => setScenes(data.scenes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    filter === "all" ? scenes : scenes.filter((s) => s.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cenas</h1>
          <p className="mt-1 text-sm text-slate-400">
            {scenes.length} {scenes.length === 1 ? "cena" : "cenas"} no total
          </p>
        </div>
        <Link
          href="/generate"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
        >
          + Nova Cena
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {f.label}
            {f.value !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                {scenes.filter((s) => s.status === f.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-900" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <p className="text-slate-400">
            {filter === "all"
              ? "Nenhuma cena encontrada."
              : `Nenhuma cena com status "${FILTERS.find((f) => f.value === filter)?.label}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((scene) => (
            <SceneCard
              key={scene.scene_id}
              scene={{
                ...scene,
                generated_images: scene.generated_images.map((img) => img.url),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

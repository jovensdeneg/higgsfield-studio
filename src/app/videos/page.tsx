"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VideoPlayer from "@/components/VideoPlayer";
import EmptyState from "@/components/EmptyState";

interface Scene {
  scene_id: string;
  original_prompt: string;
  model_image: string;
  status: string;
  video_url: string | null;
  video_config: {
    model: string;
    duration: number;
  };
  created_at: string;
}

export default function VideosPage() {
  const [completedScenes, setCompletedScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVideos() {
      try {
        setLoading(true);
        const res = await fetch("/api/scenes");
        if (!res.ok) {
          throw new Error("Erro ao carregar cenas");
        }
        const data = await res.json();
        const scenes = (data.scenes ?? []) as Scene[];
        setCompletedScenes(
          scenes.filter((s) => s.status === "completed" && s.video_url)
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar videos"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchVideos();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
          <p className="text-sm text-slate-400">Carregando videos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-red-300 underline hover:text-red-200"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Galeria de Videos</h1>
        <p className="mt-1 text-sm text-slate-400">
          {completedScenes.length} video{completedScenes.length !== 1 ? "s" : ""}{" "}
          completo{completedScenes.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Videos Grid */}
      {completedScenes.length === 0 ? (
        <EmptyState
          title="Nenhum video disponivel"
          description="Os videos aparecerao aqui quando a geracao for concluida. Crie cenas e lance um batch para comecar."
          actionLabel="Criar Nova Cena"
          actionHref="/generate"
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {completedScenes.map((scene) => (
            <div key={scene.scene_id} className="space-y-2">
              <VideoPlayer
                url={scene.video_url!}
                title={scene.original_prompt}
              />
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="font-mono">{scene.scene_id}</span>
                  <span>{scene.video_config.model}</span>
                  <span>{scene.video_config.duration}s</span>
                </div>
                <Link
                  href={`/scenes/${scene.scene_id}`}
                  className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
                >
                  Ver detalhes
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

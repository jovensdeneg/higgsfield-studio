"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import VideoPlayer from "@/components/VideoPlayer";

interface Scene {
  scene_id: string;
  original_prompt: string;
  movement_prompt: string | null;
  status: string;
  provider?: "higgsfield" | "google";
  video_config: { model: string; duration: number };
  request_id: string | null;
  video_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export default function ProductionMonitorPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAll, setCheckingAll] = useState(false);

  const fetchScenes = useCallback(async () => {
    try {
      const res = await fetch("/api/scenes");
      if (res.ok) {
        const data = await res.json();
        const all = (data.scenes ?? []) as Scene[];
        // Show only scenes that are in production or completed
        setScenes(
          all.filter(
            (s) =>
              s.status === "video_submitted" ||
              s.status === "completed" ||
              (s.status === "approved" && s.error_message)
          )
        );
      }
    } catch {
      // Silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScenes();
  }, [fetchScenes]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchScenes, 10_000);
    return () => clearInterval(interval);
  }, [fetchScenes]);

  async function handleCheckAll() {
    setCheckingAll(true);
    try {
      // Check status for all video_submitted scenes
      const submitted = scenes.filter((s) => s.status === "video_submitted");
      await Promise.all(
        submitted.map((s) =>
          fetch(`/api/scenes/${s.scene_id}/video-status`).catch(() => null)
        )
      );
      // Refresh scene list after checking
      await fetchScenes();
    } catch {
      // Silently ignore
    } finally {
      setCheckingAll(false);
    }
  }

  const submitted = scenes.filter((s) => s.status === "video_submitted");
  const completed = scenes.filter((s) => s.status === "completed");
  const failed = scenes.filter(
    (s) => s.status === "approved" && s.error_message
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-purple-500" />
          <p className="text-sm text-slate-400">Carregando producao...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Monitor de Producao
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {submitted.length} gerando | {completed.length} concluidos | {failed.length} com erro
          </p>
        </div>
        {submitted.length > 0 && (
          <button
            onClick={handleCheckAll}
            disabled={checkingAll}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {checkingAll ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-white" />
                Verificando...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
                Verificar Todos
              </>
            )}
          </button>
        )}
      </div>

      {scenes.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <p className="text-slate-400">
            Nenhum video em producao. Aprove cenas para enviar videos automaticamente.
          </p>
          <Link
            href="/scenes"
            className="mt-4 inline-block text-sm text-purple-400 hover:text-purple-300 hover:underline"
          >
            Ver Cenas
          </Link>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          {scenes.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Progresso geral</span>
                <span>
                  {completed.length}/{scenes.length} concluidos
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-500"
                  style={{
                    width: `${scenes.length > 0 ? Math.round((completed.length / scenes.length) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Auto-refresh indicator */}
          <p className="text-xs text-slate-600">
            Atualizacao automatica a cada 10 segundos
          </p>

          {/* Scene table */}
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900">
                  <th className="px-4 py-3 text-left font-medium text-slate-400">
                    Cena
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">
                    Provider
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">
                    Modelo
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">
                    Video
                  </th>
                </tr>
              </thead>
              <tbody>
                {scenes.map((scene) => (
                  <tr
                    key={scene.scene_id}
                    className="border-b border-slate-800/50 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/scenes/${scene.scene_id}`}
                        className="font-mono text-xs text-white hover:text-purple-400"
                      >
                        {scene.scene_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          scene.provider === "google"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {scene.provider === "google" ? "Google" : "Higgsfield"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {scene.video_config?.model ?? "-"} ({scene.video_config?.duration ?? "-"}s)
                    </td>
                    <td className="px-4 py-3">
                      {scene.status === "video_submitted" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-blue-400">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                          Gerando...
                        </span>
                      ) : scene.status === "completed" ? (
                        <StatusBadge status="completed" />
                      ) : scene.error_message ? (
                        <span className="text-xs text-red-400">Falhou</span>
                      ) : (
                        <StatusBadge status={scene.status} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {scene.video_url ? (
                        <a
                          href={scene.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-purple-400 hover:text-purple-300 hover:underline"
                        >
                          Abrir video
                        </a>
                      ) : scene.error_message ? (
                        <span
                          className="text-xs text-red-400 cursor-help"
                          title={scene.error_message}
                        >
                          {scene.error_message.slice(0, 50)}...
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Completed videos preview */}
          {completed.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-white">
                Videos Concluidos
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {completed
                  .filter((s) => s.video_url)
                  .map((scene) => (
                    <div
                      key={scene.scene_id}
                      className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden"
                    >
                      <div className="border-b border-slate-800 px-4 py-2">
                        <Link
                          href={`/scenes/${scene.scene_id}`}
                          className="text-sm font-medium text-white hover:text-purple-400"
                        >
                          {scene.scene_id}
                        </Link>
                      </div>
                      <div className="p-4">
                        <VideoPlayer
                          url={scene.video_url!}
                          title={scene.original_prompt}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

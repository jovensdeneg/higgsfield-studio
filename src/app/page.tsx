"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SceneCard from "@/components/SceneCard";
import EmptyState from "@/components/EmptyState";

interface Scene {
  scene_id: string;
  original_prompt: string;
  model_image: string;
  generated_images: { url: string }[];
  approved_image_index: number | null;
  status: string;
  video_url: string | null;
  created_at: string;
}

interface BatchSummary {
  completed: number;
  in_progress: number;
  failed: number;
  total: number;
  percent_complete: number;
}

interface BatchStatus {
  batch_id: string;
  status_summary?: BatchSummary;
}

export default function DashboardPage() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launchingBatch, setLaunchingBatch] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [scenesRes, batchRes] = await Promise.all([
          fetch("/api/scenes"),
          fetch("/api/batch/status"),
        ]);

        if (scenesRes.ok) {
          const data = await scenesRes.json();
          setScenes(data.scenes ?? []);
        }

        if (batchRes.ok) {
          const data = await batchRes.json();
          setBatchStatus(data.batch ?? null);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar dados"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const totalScenes = scenes.length;
  const approvedScenes = scenes.filter((s) => s.status === "approved").length;
  const completedVideos = scenes.filter((s) => s.status === "completed").length;
  const batchPercent = batchStatus?.status_summary?.percent_complete ?? 0;

  async function handleLaunchBatch() {
    setLaunchingBatch(true);
    try {
      const res = await fetch("/api/batch/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Erro ao lancar batch");
      } else {
        // Refresh batch status
        const batchRes = await fetch("/api/batch/status");
        if (batchRes.ok) {
          const data = await batchRes.json();
          setBatchStatus(data.batch ?? null);
        }
      }
    } catch {
      alert("Erro de rede ao lancar batch");
    } finally {
      setLaunchingBatch(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
          <p className="text-sm text-slate-400">Carregando dashboard...</p>
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Visao geral da producao de cenas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/generate"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Nova Cena
          </Link>
          <button
            onClick={handleLaunchBatch}
            disabled={launchingBatch || approvedScenes === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {launchingBatch ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-white" />
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                />
              </svg>
            )}
            Lancar Batch
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15">
              <svg
                className="h-5 w-5 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalScenes}</p>
              <p className="text-xs text-slate-400">Total Cenas</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
              <svg
                className="h-5 w-5 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{approvedScenes}</p>
              <p className="text-xs text-slate-400">Aprovadas</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
              <svg
                className="h-5 w-5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{completedVideos}</p>
              <p className="text-xs text-slate-400">Videos Prontos</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/15">
              <svg
                className="h-5 w-5 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"
                />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{batchPercent}%</p>
              <p className="text-xs text-slate-400">Batch Status</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Scenes */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Cenas Recentes</h2>
          {scenes.length > 0 && (
            <Link
              href="/scenes"
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              Ver todas
            </Link>
          )}
        </div>

        {scenes.length === 0 ? (
          <EmptyState
            title="Nenhuma cena criada"
            description="Comece gerando sua primeira cena com inteligencia artificial."
            actionLabel="Criar Primeira Cena"
            actionHref="/generate"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scenes.slice(0, 6).map((scene) => (
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
    </div>
  );
}

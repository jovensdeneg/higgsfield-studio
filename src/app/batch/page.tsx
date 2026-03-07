"use client";

import { useEffect, useState, useCallback } from "react";
import SceneCard from "@/components/SceneCard";
import BatchProgress from "@/components/BatchProgress";
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

interface BatchJob {
  scene_id: string;
  request_id: string | null;
  prompt_sent?: string;
  model?: string;
  status: string;
  error?: string;
}

interface BatchSummary {
  completed: number;
  in_progress: number;
  failed: number;
  total: number;
  percent_complete: number;
}

interface BatchData {
  batch_id: string;
  scenes: BatchJob[];
  status_summary?: BatchSummary;
  last_check?: string;
  created_at: string;
}

interface CollectResult {
  scene_id: string;
  request_id: string;
  video_url: string | null;
  status: string;
  error?: string;
}

export default function BatchPage() {
  const [approvedScenes, setApprovedScenes] = useState<Scene[]>([]);
  const [batch, setBatch] = useState<BatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [collectResults, setCollectResults] = useState<CollectResult[] | null>(
    null
  );

  const fetchData = useCallback(async () => {
    try {
      const [scenesRes, batchRes] = await Promise.all([
        fetch("/api/scenes"),
        fetch("/api/batch/status"),
      ]);

      if (scenesRes.ok) {
        const data = await scenesRes.json();
        const scenes = (data.scenes ?? []) as Scene[];
        setApprovedScenes(
          scenes.filter((s) => s.status === "approved")
        );
      }

      if (batchRes.ok) {
        const data = await batchRes.json();
        setBatch(data.batch ?? null);
      }
    } catch {
      // Silently handle errors on refresh
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh batch status every 10 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/batch/status");
        if (res.ok) {
          const data = await res.json();
          setBatch(data.batch ?? null);
        }
      } catch {
        // Silently ignore refresh errors
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, []);

  async function handleLaunchBatch() {
    setLaunching(true);
    try {
      const res = await fetch("/api/batch/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? "Erro ao lancar batch");
        return;
      }

      setBatch(data.batch ?? null);
      // Refresh approved scenes (they should now be video_submitted)
      const scenesRes = await fetch("/api/scenes");
      if (scenesRes.ok) {
        const scenesData = await scenesRes.json();
        const scenes = (scenesData.scenes ?? []) as Scene[];
        setApprovedScenes(scenes.filter((s) => s.status === "approved"));
      }
    } catch {
      alert("Erro de rede ao lancar batch");
    } finally {
      setLaunching(false);
    }
  }

  async function handleCollectResults() {
    setCollecting(true);
    try {
      const res = await fetch("/api/batch/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? "Erro ao coletar resultados");
        return;
      }

      setCollectResults(data.results ?? []);

      // Refresh batch status
      const batchRes = await fetch("/api/batch/status");
      if (batchRes.ok) {
        const batchData = await batchRes.json();
        setBatch(batchData.batch ?? null);
      }
    } catch {
      alert("Erro de rede ao coletar resultados");
    } finally {
      setCollecting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
          <p className="text-sm text-slate-400">Carregando batch...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Section 1: Approved scenes ready for batch */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              Cenas Prontas para Batch
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {approvedScenes.length} cena{approvedScenes.length !== 1 ? "s" : ""}{" "}
              aprovada{approvedScenes.length !== 1 ? "s" : ""} aguardando
              lancamento
            </p>
          </div>
          <button
            onClick={handleLaunchBatch}
            disabled={launching || approvedScenes.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {launching ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                Lancando...
              </>
            ) : (
              <>
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
                Lancar Batch
              </>
            )}
          </button>
        </div>

        {approvedScenes.length === 0 ? (
          <EmptyState
            title="Nenhuma cena aprovada"
            description="Aprove cenas na pagina de detalhes para adiciona-las ao batch."
            actionLabel="Ver Cenas"
            actionHref="/scenes"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {approvedScenes.map((scene) => (
              <SceneCard
                key={scene.scene_id}
                scene={{
                  ...scene,
                  generated_images: scene.generated_images.map(
                    (img) => img.url
                  ),
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Batch Status */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Status do Batch</h2>
            {batch && (
              <p className="mt-1 text-sm text-slate-400">
                Batch: {batch.batch_id}
              </p>
            )}
          </div>
          {batch &&
            batch.status_summary &&
            batch.status_summary.completed > 0 && (
              <button
                onClick={handleCollectResults}
                disabled={collecting}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                {collecting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-white" />
                    Coletando...
                  </>
                ) : (
                  <>
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
                        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                      />
                    </svg>
                    Coletar Resultados
                  </>
                )}
              </button>
            )}
        </div>

        {!batch ? (
          <EmptyState
            title="Nenhum batch iniciado"
            description="Lance um batch com as cenas aprovadas para iniciar a geracao de videos."
          />
        ) : (
          <div className="space-y-6">
            {/* Progress */}
            {batch.status_summary && (
              <BatchProgress summary={batch.status_summary} />
            )}

            {/* Auto-refresh indicator */}
            <p className="text-xs text-slate-600">
              Atualizacao automatica a cada 10 segundos
              {batch.last_check && (
                <>
                  {" "}
                  - Ultima verificacao:{" "}
                  {new Date(batch.last_check).toLocaleTimeString("pt-BR")}
                </>
              )}
            </p>

            {/* Jobs Table */}
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900">
                    <th className="px-4 py-3 text-left font-medium text-slate-400">
                      Cena
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-400">
                      Modelo
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-400">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-400">
                      Request ID
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batch.scenes.map((job) => (
                    <tr
                      key={job.scene_id}
                      className="border-b border-slate-800/50 last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-white">
                        {job.scene_id}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {job.model ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            job.status === "completed"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : job.status === "failed" ||
                                  job.status === "error"
                                ? "bg-red-500/15 text-red-400"
                                : job.status === "submitted"
                                  ? "bg-blue-500/15 text-blue-400"
                                  : "bg-slate-700/50 text-slate-400"
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {job.request_id
                          ? job.request_id.slice(0, 16) + "..."
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Section 3: Collected Results */}
      {collectResults && collectResults.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold text-white">
            Resultados Coletados
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900">
                  <th className="px-4 py-3 text-left font-medium text-slate-400">
                    Cena
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
                {collectResults.map((result) => (
                  <tr
                    key={result.scene_id}
                    className="border-b border-slate-800/50 last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-white">
                      {result.scene_id}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          result.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : result.status === "error"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-slate-700/50 text-slate-400"
                        }`}
                      >
                        {result.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {result.video_url ? (
                        <a
                          href={result.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
                        >
                          Abrir video
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {result.error ?? "Indisponivel"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

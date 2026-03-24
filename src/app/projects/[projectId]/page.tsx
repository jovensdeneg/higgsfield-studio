"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Asset {
  id: string;
  asset_code: string;
  scene: string;
  description: string;
  scenedescription: string | null;
  asset_type: string;
  image_tool: string;
  video_tool: string;
  prompt_image: string;
  prompt_image1: string | null;
  prompt_image2: string | null;
  prompt_video: string;
  duration: number | null;
  notes: string;
  status: string;
  image_url: string | null;
  image1_url: string | null;
  image2_url: string | null;
  video_url: string | null;
  error_message: string | null;
  review_notes: string | null;
  depends_on: string | null;
}

interface Project {
  id: string;
  name: string;
  created_at: string;
  assets: Asset[];
}

type AssetStatus =
  | "pending"
  | "generating"
  | "ready"
  | "approved"
  | "rejected"
  | "failed";

const STATUS_CONFIG: Record<
  AssetStatus,
  { label: string; bg: string; text: string; ring: string; pulse?: boolean }
> = {
  pending: {
    label: "Pendente",
    bg: "bg-slate-500/15",
    text: "text-slate-400",
    ring: "ring-slate-500/30",
  },
  generating: {
    label: "Gerando",
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    ring: "ring-blue-500/30",
    pulse: true,
  },
  ready: {
    label: "Pronto",
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    ring: "ring-amber-500/30",
  },
  approved: {
    label: "Aprovado",
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    ring: "ring-purple-500/30",
  },
  rejected: {
    label: "Rejeitado",
    bg: "bg-red-500/15",
    text: "text-red-400",
    ring: "ring-red-500/30",
  },
  failed: {
    label: "Falhou",
    bg: "bg-red-500/10",
    text: "text-red-400",
    ring: "ring-red-500/40",
  },
};

function AssetStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as AssetStatus];
  if (!config) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-700/50 px-2.5 py-0.5 text-[10px] font-medium text-slate-400 ring-1 ring-inset ring-slate-600/30">
        {status}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${config.bg} ${config.text} ${config.ring}`}
    >
      {config.pulse && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {config.label}
    </span>
  );
}

export default function ProjectDashboardPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState<"images" | "videos" | null>(
    null
  );
  const [dispatchResult, setDispatchResult] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);
  const [imageProvider, setImageProvider] = useState<string>("imagen4");
  const [videoProvider, setVideoProvider] = useState<string>("runway");
  // Per-asset provider overrides for regeneration
  const [regenImageProvider, setRegenImageProvider] = useState<Record<string, string>>({});
  const [regenVideoProvider, setRegenVideoProvider] = useState<Record<string, string>>({});
  const dispatchQueueRef = useRef<string[]>([]);
  const isDispatchingRef = useRef(false);

  // Filters
  const [sceneFilter, setSceneFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Erro ao carregar projeto");
      const data = await res.json();
      setProject(data.project ?? data);
      setAssets(data.project?.assets ?? data.assets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Supabase Realtime subscription for asset changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`project-assets-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assets",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Asset;
            setAssets((prev) =>
              prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
            );
          } else if (payload.eventType === "INSERT") {
            setAssets((prev) => [...prev, payload.new as Asset]);
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id: string };
            setAssets((prev) => prev.filter((a) => a.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Derived data
  const scenes = useMemo(
    () => [...new Set(assets.map((a) => a.scene).filter(Boolean))].sort(),
    [assets]
  );

  const assetTypes = useMemo(
    () =>
      [...new Set(assets.map((a) => a.asset_type).filter(Boolean))].sort(),
    [assets]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return counts;
  }, [assets]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (sceneFilter !== "all" && a.scene !== sceneFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (typeFilter !== "all" && a.asset_type !== typeFilter) return false;
      return true;
    });
  }, [assets, sceneFilter, statusFilter, typeFilter]);

  async function handleApprove(assetId: string) {
    setActionLoading(assetId);
    try {
      const res = await fetch(`/api/assets/${assetId}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        setAssets((prev) =>
          prev.map((a) =>
            a.id === assetId ? { ...a, status: "approved" } : a
          )
        );
      }
    } catch {
      /* ignore */
    }
    setActionLoading(null);
  }

  async function handleReject(assetId: string) {
    const notes = rejectNotes[assetId]?.trim();
    if (!notes || notes.length < 5) return;
    setActionLoading(assetId);
    try {
      const res = await fetch(`/api/assets/${assetId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_notes: notes }),
      });
      if (res.ok) {
        setAssets((prev) =>
          prev.map((a) =>
            a.id === assetId ? { ...a, status: "rejected" } : a
          )
        );
        setShowRejectInput(null);
        setRejectNotes((prev) => {
          const next = { ...prev };
          delete next[assetId];
          return next;
        });
      }
    } catch {
      /* ignore */
    }
    setActionLoading(null);
  }

  async function handleRegenerate(assetId: string) {
    setActionLoading(assetId);
    try {
      const asset = assets.find((a) => a.id === assetId);
      const feedback = rejectNotes[assetId]?.trim() || asset?.review_notes?.trim();
      const provider = regenImageProvider[assetId] ?? imageProvider;

      // Build updated prompt: append feedback to original prompt
      let updatedPrompt: string | undefined;
      if (feedback && asset?.prompt_image) {
        updatedPrompt = `${asset.prompt_image}\n\n[FEEDBACK: ${feedback}]`;
      }

      // 1. Reset asset to pending
      const res = await fetch(`/api/assets/${assetId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(updatedPrompt ? { prompt_image: updatedPrompt } : {}),
        }),
      });
      if (res.ok) {
        setAssets((prev) =>
          prev.map((a) =>
            a.id === assetId
              ? { ...a, status: "pending", image_url: null, video_url: null, error_message: null, review_notes: null }
              : a
          )
        );
        setShowRejectInput(null);
        setRejectNotes((prev) => {
          const next = { ...prev };
          delete next[assetId];
          return next;
        });

        // 2. Immediately dispatch image generation with selected provider
        try {
          await fetch("/api/dispatch/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assetId, provider }),
          });
        } catch {
          /* dispatch will be retried manually if it fails */
        }
      }
    } catch {
      /* ignore */
    }
    setActionLoading(null);
  }

  async function handleRetryVideo(assetId: string) {
    setActionLoading(assetId);
    try {
      const asset = assets.find((a) => a.id === assetId);
      const feedback = rejectNotes[assetId]?.trim() || asset?.review_notes?.trim();
      const provider = regenVideoProvider[assetId] ?? videoProvider;

      // Send ONLY the feedback as prompt_video (not the original prompt)
      // The base image is kept intact — provider uses feedback + image to regenerate
      if (feedback) {
        await fetch(`/api/projects/${projectId}/assets`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [assetId], updates: { prompt_video: feedback } }),
        });
      }

      // 1. Reset asset to "approved" (keeps image_url intact)
      await fetch(`/api/assets/${assetId}/approve`, { method: "POST" });
      // 2. Dispatch video for this single asset
      const res = await fetch("/api/dispatch/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, provider }),
      });
      if (res.ok) {
        setAssets((prev) =>
          prev.map((a) =>
            a.id === assetId
              ? { ...a, status: "generating", error_message: null }
              : a
          )
        );
      }
    } catch {
      /* ignore */
    }
    setActionLoading(null);
  }

  async function handleDispatchImages() {
    // Prevent double-clicks
    if (isDispatchingRef.current) return;

    // Find assets that need image generation:
    // - "pending" with prompt_image1 or prompt_image → needs image1
    // - "generating" with image1_url/image_url but no image2_url and has prompt_image2 → needs image2
    const pendingAssets = assets.filter((a) => {
      if (a.status === "pending" && (a.prompt_image1 || a.prompt_image)) return true;
      if (a.status === "generating" && (a.image1_url || a.image_url) && !a.image2_url && a.prompt_image2) return true;
      return false;
    });

    if (pendingAssets.length === 0) {
      setDispatchResult("Nenhum asset pendente com prompt de imagem.");
      return;
    }

    isDispatchingRef.current = true;
    setDispatching("images");
    setDispatchResult(null);

    const provider = imageProvider;
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    const total = pendingAssets.length;

    // Process one scene at a time: image1 → image2 (sequential per scene)
    for (let i = 0; i < total; i++) {
      const asset = pendingAssets[i];
      if (!asset) break;

      // Determine which image to generate
      const needsImage1 = asset.status === "pending";
      const needsImage2 = !needsImage1 && !!asset.prompt_image2 && !asset.image2_url;

      if (needsImage1) {
        // Generate image1 (frame inicial)
        setDispatchResult(
          `Cena ${i + 1}/${total} — gerando frame inicial... (${completed} ok, ${failed} falhas)`
        );
        try {
          const res = await fetch("/api/dispatch/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assetId: asset.id, provider, imageNumber: 1 }),
          });
          const data = await res.json();
          if (data.status === "failed") { failed++; continue; }
          if (data.status === "skipped") { skipped++; continue; }

          // If image1 succeeded and there's a prompt_image2, generate image2 immediately
          if (data.status === "completed" && data.needsImage2) {
            setDispatchResult(
              `Cena ${i + 1}/${total} — gerando frame final... (${completed} ok, ${failed} falhas)`
            );
            const res2 = await fetch("/api/dispatch/images", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assetId: asset.id, provider, imageNumber: 2 }),
            });
            const data2 = await res2.json();
            if (data2.status === "completed") completed++;
            else if (data2.status === "failed") failed++;
            else if (data2.status === "skipped") skipped++;
          } else {
            completed++;
          }
        } catch {
          failed++;
        }
      } else if (needsImage2) {
        // Generate image2 only (image1 already exists)
        setDispatchResult(
          `Cena ${i + 1}/${total} — gerando frame final... (${completed} ok, ${failed} falhas)`
        );
        try {
          const res = await fetch("/api/dispatch/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assetId: asset.id, provider, imageNumber: 2 }),
          });
          const data = await res.json();
          if (data.status === "completed") completed++;
          else if (data.status === "failed") failed++;
          else if (data.status === "skipped") skipped++;
        } catch {
          failed++;
        }
      }
    }

    setDispatchResult(
      `Cenas: ${completed} completas, ${failed} falhas, ${skipped} ignoradas`
    );
    setDispatching(null);
    isDispatchingRef.current = false;
    dispatchQueueRef.current = [];
  }

  async function handleDispatchVideos() {
    if (isDispatchingRef.current) return;

    const approvedIds = assets
      .filter((a) => a.status === "approved" && a.image_url)
      .map((a) => a.id);
    if (approvedIds.length === 0) {
      setDispatchResult("Nenhum asset aprovado com imagem pronta.");
      return;
    }

    dispatchQueueRef.current = [...approvedIds];
    isDispatchingRef.current = true;
    setDispatching("videos");
    setDispatchResult(null);

    const total = approvedIds.length;
    const provider = videoProvider;
    let submitted = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < total; i++) {
      const assetId = dispatchQueueRef.current[i];
      if (!assetId) break;

      setDispatchResult(
        `Enviando video ${i + 1}/${total}... (${submitted} ok, ${failed} falhas)`
      );
      try {
        const res = await fetch("/api/dispatch/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId, provider }),
        });
        const data = await res.json();
        if (data.status === "submitted") submitted++;
        else if (data.status === "failed") {
          failed++;
          // Stop on no credits
          if (data.noCredits) {
            setDispatchResult(
              `Sem creditos! ${submitted} enviados, ${failed} falhas, ${total - i - 1} restantes`
            );
            break;
          }
        } else if (data.status === "skipped") skipped++;
      } catch {
        failed++;
      }
    }

    setDispatchResult(
      `Videos: ${submitted} enviados, ${failed} falhas, ${skipped} ignorados`
    );
    setDispatching(null);
    isDispatchingRef.current = false;
    dispatchQueueRef.current = [];
  }

  async function handlePollJobs() {
    try {
      // 1. Clean up stale "generating" assets (stuck > 5min)
      await fetch("/api/cleanup/stale", { method: "POST" }).catch(() => {});

      // 2. Poll running video jobs
      const res = await fetch("/api/jobs/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.completed > 0 || data.failed > 0) {
        setDispatchResult(
          `Poll: ${data.completed} concluídos, ${data.failed} falhos, ${data.running} em progresso`
        );
        // Refresh to get updated URLs
        fetchProject();
      }
    } catch {
      /* silent */
    }
  }

  // Auto-poll running jobs every 15s
  useEffect(() => {
    const hasRunning = assets.some((a) => a.status === "generating");
    if (!hasRunning) return;

    const interval = setInterval(handlePollJobs, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, projectId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-800" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 w-24 animate-pulse rounded-full bg-slate-800"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-xl border border-slate-800 bg-slate-900"
            />
          ))}
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

  const pendingCount = statusCounts["pending"] ?? 0;
  const generatingCount = statusCounts["generating"] ?? 0;
  const readyCount = statusCounts["ready"] ?? 0;
  const approvedCount = statusCounts["approved"] ?? 0;
  const rejectedCount = statusCounts["rejected"] ?? 0;
  const failedCount = statusCounts["failed"] ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/projects"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-purple-400"
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
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            Projetos
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {project?.name ?? "Projeto"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={imageProvider}
            onChange={(e) => setImageProvider(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition-colors hover:border-slate-600 focus:border-purple-500"
            disabled={dispatching !== null}
          >
            <option value="imagen4">Imagen 4</option>
            <option value="higgsfield">Higgsfield</option>
            <option value="google">Google AI</option>
            <option value="runway">Runway</option>
          </select>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
            onClick={handleDispatchImages}
            disabled={dispatching !== null}
          >
            {dispatching === "images" ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
                  d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                />
              </svg>
            )}
            Gerar Imagens {pendingCount > 0 && `(${pendingCount})`}
          </button>
          <select
            value={videoProvider}
            onChange={(e) => setVideoProvider(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition-colors hover:border-slate-600 focus:border-blue-500"
            disabled={dispatching !== null}
          >
            <option value="runway">Runway Gen4.5</option>
            <option value="higgsfield">Higgsfield Kling</option>
            <option value="google">Google Veo</option>
          </select>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            onClick={handleDispatchVideos}
            disabled={dispatching !== null}
          >
            {dispatching === "videos" ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
                  d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
            )}
            Gerar Vídeos {approvedCount > 0 && `(${approvedCount})`}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <span className="h-2 w-2 rounded-full bg-slate-500" />
          {pendingCount} pendentes
        </span>
        <span className="text-slate-700">|</span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-blue-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
          {generatingCount} gerando
        </span>
        <span className="text-slate-700">|</span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          {readyCount} prontos
        </span>
        <span className="text-slate-700">|</span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-purple-400">
          <span className="h-2 w-2 rounded-full bg-purple-400" />
          {approvedCount} aprovados
        </span>
        {rejectedCount > 0 && (
          <>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              {rejectedCount} rejeitados
            </span>
          </>
        )}
        {failedCount > 0 && (
          <>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {failedCount} falhos
            </span>
          </>
        )}
      </div>

      {/* Dispatch Result Toast */}
      {dispatchResult && (
        <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
          <p className="text-sm text-slate-300">{dispatchResult}</p>
          <button
            onClick={() => setDispatchResult(null)}
            className="ml-4 text-xs text-slate-500 hover:text-slate-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Scene filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Cena
          </span>
          <button
            onClick={() => setSceneFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              sceneFilter === "all"
                ? "bg-purple-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Todas
          </button>
          {scenes.map((scene) => (
            <button
              key={scene}
              onClick={() => setSceneFilter(scene)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                sceneFilter === scene
                  ? "bg-purple-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {scene}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Status
          </span>
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === "all"
                ? "bg-purple-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Todos
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = statusCounts[key] ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === key
                    ? "bg-purple-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {cfg.label}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Type filter */}
        {assetTypes.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Tipo
            </span>
            <button
              onClick={() => setTypeFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === "all"
                  ? "bg-purple-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Todos
            </button>
            {assetTypes.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  typeFilter === t
                    ? "bg-purple-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Assets Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <p className="text-sm text-slate-400">
            Nenhum asset encontrado com os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition-all hover:border-slate-700"
            >
              {/* Dual Image Display (Frame Inicial + Frame Final) */}
              {(() => {
                const img1 = asset.image1_url ?? asset.image_url;
                const img2 = asset.image2_url;
                const hasDualImages = !!img1 && !!img2;
                const hasAnyImage = !!img1 || !!img2;

                return (
                  <div className="relative w-full overflow-hidden bg-slate-800">
                    {asset.video_url ? (
                      <div className="aspect-video">
                        <video
                          src={asset.video_url}
                          poster={img1 ?? undefined}
                          controls
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : hasDualImages ? (
                      /* Side-by-side dual images */
                      <div className="flex">
                        <div className="relative w-1/2 border-r border-slate-700/50">
                          <div className="aspect-video overflow-hidden">
                            <img src={img1!} alt={`${asset.asset_code} - Frame Inicial`} className="h-full w-full object-cover" />
                          </div>
                          <span className="absolute bottom-1 left-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-300 backdrop-blur-sm">
                            Inicial
                          </span>
                        </div>
                        <div className="relative w-1/2">
                          <div className="aspect-video overflow-hidden">
                            <img src={img2!} alt={`${asset.asset_code} - Frame Final`} className="h-full w-full object-cover" />
                          </div>
                          <span className="absolute bottom-1 left-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-300 backdrop-blur-sm">
                            Final
                          </span>
                        </div>
                      </div>
                    ) : img1 ? (
                      /* Single image (image1 only, image2 pending) */
                      <div className="flex">
                        <div className="relative w-1/2 border-r border-slate-700/50">
                          <div className="aspect-video overflow-hidden">
                            <img src={img1} alt={`${asset.asset_code} - Frame Inicial`} className="h-full w-full object-cover" />
                          </div>
                          <span className="absolute bottom-1 left-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-300 backdrop-blur-sm">
                            Inicial
                          </span>
                        </div>
                        <div className="flex w-1/2 items-center justify-center">
                          <div className="text-center">
                            <svg className="mx-auto h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                            </svg>
                            <p className="mt-1 text-[9px] text-slate-500">Frame Final</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* No images yet */
                      <div className="flex aspect-video items-center justify-center">
                        <svg className="h-8 w-8 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                        </svg>
                      </div>
                    )}
                    {/* Status overlay */}
                    <div className="absolute right-2 top-2 z-10">
                      <AssetStatusBadge status={asset.status} />
                    </div>
                    {/* Dependency badge */}
                    {asset.depends_on && (
                      <div className="absolute left-2 top-2 z-10 rounded bg-purple-900/80 px-1.5 py-0.5 text-[9px] font-medium text-purple-300 backdrop-blur-sm">
                        Dep: {asset.depends_on}
                      </div>
                    )}
                    {/* Download buttons */}
                    {hasAnyImage && (
                      <div className="absolute bottom-2 right-2 z-10 flex gap-1 opacity-0 transition-all group-hover:opacity-100">
                        {img1 && (
                          <a href={img1} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            className="flex h-7 items-center gap-1 rounded-full bg-slate-900/80 px-2 text-[9px] text-white backdrop-blur-sm hover:bg-purple-600" title="Baixar Frame Inicial">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            1
                          </a>
                        )}
                        {img2 && (
                          <a href={img2} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            className="flex h-7 items-center gap-1 rounded-full bg-slate-900/80 px-2 text-[9px] text-white backdrop-blur-sm hover:bg-purple-600" title="Baixar Frame Final">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            2
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Content */}
              <div className="p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-bold text-white">
                    {asset.asset_code}
                  </h3>
                </div>
                {asset.scenedescription && (
                  <p className="mb-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                    {asset.scenedescription}
                  </p>
                )}
                {!asset.scenedescription && asset.description && (
                  <p className="mb-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                    {asset.description}
                  </p>
                )}

                {/* Actions for "ready" assets */}
                {asset.status === "ready" && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(asset.id)}
                        disabled={actionLoading === asset.id}
                        className="flex-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
                      >
                        {actionLoading === asset.id ? (
                          <div className="mx-auto h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                          "Aprovar"
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setShowRejectInput(
                            showRejectInput === asset.id ? null : asset.id
                          )
                        }
                        disabled={actionLoading === asset.id}
                        className="flex-1 rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/40 disabled:opacity-50"
                      >
                        Rejeitar
                      </button>
                    </div>
                    {/* Reject: feedback + provider selector + regenerate options */}
                    {showRejectInput === asset.id && (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          placeholder="Descreva o ajuste desejado..."
                          value={rejectNotes[asset.id] ?? ""}
                          onChange={(e) =>
                            setRejectNotes((prev) => ({
                              ...prev,
                              [asset.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-600 focus:outline-none"
                        />
                        {/* Regenerar Video option — only if video already exists */}
                        {asset.video_url && (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={regenVideoProvider[asset.id] ?? videoProvider}
                              onChange={(e) => setRegenVideoProvider((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] text-white outline-none"
                            >
                              <option value="runway">Runway</option>
                              <option value="higgsfield">Higgsfield</option>
                              <option value="google">Google</option>
                            </select>
                            <button
                              onClick={() => handleRetryVideo(asset.id)}
                              disabled={
                                actionLoading === asset.id ||
                                (rejectNotes[asset.id]?.trim().length ?? 0) < 3
                              }
                              className="flex-1 rounded-lg border border-blue-700/50 bg-blue-900/20 px-2 py-1.5 text-[10px] font-medium text-blue-400 transition-colors hover:bg-blue-900/40 disabled:opacity-50"
                            >
                              {actionLoading === asset.id ? (
                                <div className="mx-auto h-3 w-3 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
                              ) : (
                                "Regenerar Video"
                              )}
                            </button>
                          </div>
                        )}
                        {/* Regenerar Imagem option — always available */}
                        <div className="flex items-center gap-1.5">
                          <select
                            value={regenImageProvider[asset.id] ?? imageProvider}
                            onChange={(e) => setRegenImageProvider((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] text-white outline-none"
                          >
                            <option value="higgsfield">Higgsfield</option>
                            <option value="google">Google</option>
                            <option value="runway">Runway</option>
                          </select>
                          <button
                            onClick={() => handleRegenerate(asset.id)}
                            disabled={
                              actionLoading === asset.id ||
                              (rejectNotes[asset.id]?.trim().length ?? 0) < 3
                            }
                            className="flex-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                          >
                            {actionLoading === asset.id ? (
                              <div className="mx-auto h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                              "Regenerar Imagem"
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Regenerate for failed/rejected assets */}
                {(asset.status === "failed" ||
                  asset.status === "rejected") && (
                  <div className="mt-3 space-y-2">
                    {asset.error_message && (
                      <p className="mb-2 text-[10px] text-red-400/80">
                        {asset.error_message}
                      </p>
                    )}
                    {asset.status === "rejected" && asset.review_notes && (
                      <p className="mb-2 text-[10px] text-red-400/80">
                        Nota: {asset.review_notes}
                      </p>
                    )}
                    {/* Feedback input (always visible for regeneration) */}
                    <input
                      type="text"
                      placeholder="Feedback opcional para ajuste..."
                      value={rejectNotes[asset.id] ?? ""}
                      onChange={(e) =>
                        setRejectNotes((prev) => ({ ...prev, [asset.id]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-600 focus:outline-none"
                    />
                    {/* Show "Regenerar Video" ONLY if video was generated at least once */}
                    {asset.video_url && (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={regenVideoProvider[asset.id] ?? videoProvider}
                          onChange={(e) => setRegenVideoProvider((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] text-white outline-none"
                        >
                          <option value="runway">Runway</option>
                          <option value="higgsfield">Higgsfield</option>
                          <option value="google">Google</option>
                        </select>
                        <button
                          onClick={() => handleRetryVideo(asset.id)}
                          disabled={actionLoading === asset.id}
                          className="flex-1 rounded-lg border border-blue-700/50 bg-blue-900/20 px-2 py-1.5 text-[10px] font-medium text-blue-400 transition-colors hover:bg-blue-900/40 disabled:opacity-50"
                        >
                          {actionLoading === asset.id ? (
                            <div className="mx-auto h-3 w-3 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
                          ) : (
                            "Regenerar Video"
                          )}
                        </button>
                      </div>
                    )}
                    {/* Regenerate image */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={regenImageProvider[asset.id] ?? imageProvider}
                        onChange={(e) => setRegenImageProvider((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] text-white outline-none"
                      >
                        <option value="higgsfield">Higgsfield</option>
                        <option value="google">Google</option>
                        <option value="runway">Runway</option>
                      </select>
                      <button
                        onClick={() => handleRegenerate(asset.id)}
                        disabled={actionLoading === asset.id}
                        className="flex-1 rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-900/40 disabled:opacity-50"
                      >
                        {actionLoading === asset.id ? (
                          <div className="mx-auto h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
                        ) : (
                          "Regenerar Imagem"
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Generating indicator */}
                {asset.status === "generating" && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-blue-400">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
                    Gerando...
                  </div>
                )}

                {/* Undo option for approved assets */}
                {asset.status === "approved" && (
                  <div className="mt-3 space-y-2">
                    {showRejectInput === asset.id ? (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          placeholder="Descreva o ajuste desejado..."
                          value={rejectNotes[asset.id] ?? ""}
                          onChange={(e) =>
                            setRejectNotes((prev) => ({
                              ...prev,
                              [asset.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-600 focus:outline-none"
                        />
                        <div className="flex items-center gap-1.5">
                          <select
                            value={regenImageProvider[asset.id] ?? imageProvider}
                            onChange={(e) => setRegenImageProvider((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                            className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[10px] text-white outline-none"
                          >
                            <option value="higgsfield">Higgsfield</option>
                            <option value="google">Google</option>
                            <option value="runway">Runway</option>
                          </select>
                          <button
                            onClick={() => handleRegenerate(asset.id)}
                            disabled={
                              actionLoading === asset.id ||
                              (rejectNotes[asset.id]?.trim().length ?? 0) < 5
                            }
                            className="flex-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                          >
                            Enviar
                          </button>
                          <button
                            onClick={() => setShowRejectInput(null)}
                            className="rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowRejectInput(asset.id)}
                        disabled={actionLoading === asset.id}
                        className="w-full rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-900/40 disabled:opacity-50"
                      >
                        Ajustar Imagem
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

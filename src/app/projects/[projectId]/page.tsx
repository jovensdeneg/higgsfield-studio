"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/** Lightbox overlay for viewing images full-size */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        <button onClick={onClose} className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700">
          &times;
        </button>
      </div>
    </div>
  );
}

/** Copy-to-clipboard button */
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-700 hover:text-white"
      title="Copiar"
    >
      {copied ? (
        <svg className="h-3 w-3 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
      ) : (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
      )}
    </button>
  );
}

/** Edit pencil button */
function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="ml-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-700 hover:text-white"
      title="Editar"
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
    </button>
  );
}

/** Modal for editing reject/regeneration prompt — stable component with internal state */
function RejectModal({
  assetCode,
  imgNum,
  initialText,
  otherImgLabel,
  hasOtherImg,
  providers,
  defaultProvider,
  uploadedRefs,
  uploadingRef: isUploading,
  onUploadRefs,
  onRemoveRef,
  onLightboxRef,
  onSubmit,
  onClose,
}: {
  assetCode: string;
  imgNum: 1 | 2;
  initialText: string;
  otherImgLabel: string | null;
  hasOtherImg: boolean;
  providers: { value: string; label: string }[];
  defaultProvider: string;
  uploadedRefs: { url: string; name: string }[];
  uploadingRef: boolean;
  onUploadRefs: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveRef: (index: number) => void;
  onLightboxRef: (url: string) => void;
  onSubmit: (text: string, provider: string, carryRef: boolean) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [provider, setProvider] = useState(defaultProvider);
  const [carry, setCarry] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus textarea on open
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <h3 className="text-sm font-semibold text-white">
            Regenerar Imagem {imgNum} — {assetCode}
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white">
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Novo prompt / ajuste para imagem {imgNum}
            </label>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full resize-y rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-sm leading-relaxed text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30"
              placeholder="Descreva o que quer diferente nesta imagem..."
            />
          </div>

          {/* Options row */}
          <div className="flex flex-wrap items-center gap-3">
            {hasOtherImg && (
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={carry}
                  onChange={(e) => setCarry(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800"
                />
                Levar {otherImgLabel} como referencia
              </label>
            )}

            {/* Ref image upload — multiple */}
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-600 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-purple-500 hover:text-purple-300">
              {isUploading ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500 border-t-white" />
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
              )}
              {uploadedRefs.length > 0 ? `${uploadedRefs.length} referencia(s)` : "Imagens de referencia"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={onUploadRefs} />
            </label>
          </div>

          {/* Uploaded refs preview */}
          {uploadedRefs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {uploadedRefs.map((ref, ri) => (
                <div key={ri} className="group relative">
                  <img
                    src={ref.url} alt={ref.name}
                    className="h-14 w-14 cursor-pointer rounded border border-slate-600 object-cover"
                    onClick={() => onLightboxRef(ref.url)}
                  />
                  <button
                    onClick={() => onRemoveRef(ri)}
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                    title="Remover"
                  >&times;</button>
                </div>
              ))}
              <span className="text-[10px] text-slate-500">Serao enviadas como referencia visual</span>
            </div>
          )}

          {/* Provider + action */}
          <div className="flex items-center gap-3 border-t border-slate-700 pt-4">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white outline-none"
            >
              {providers.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <button
              onClick={() => onSubmit(text, provider, carry)}
              disabled={text.trim().length < 3}
              className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
            >
              Regenerar Imagem {imgNum}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  parameters: Record<string, unknown> | null;
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
    bg: "bg-green-500/15",
    text: "text-green-400",
    ring: "ring-green-500/30",
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
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null); // "assetId-1" or "assetId-2"
  const [imageProvider, setImageProvider] = useState<string>("google");
  const [videoProvider, setVideoProvider] = useState<string>("runway");
  // Per-asset provider overrides for regeneration
  const [regenImageProvider, setRegenImageProvider] = useState<Record<string, string>>({});
  const [regenVideoProvider, setRegenVideoProvider] = useState<Record<string, string>>({});
  // Inline prompt editing: key = "assetId-prompt_image1" etc., value = current edit text
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null); // key of currently editing prompt
  const [editDraft, setEditDraft] = useState<string>("");
  // Carry-reference toggles: when regenerating image X, optionally send the other image as reference
  const [carryReference, setCarryReference] = useState<Record<string, boolean>>({});
  // Uploaded reference images for regeneration (key = "assetId-imgNum")
  const [regenRefImages, setRegenRefImages] = useState<Record<string, { url: string; name: string }[]>>({});
  const [uploadingRef, setUploadingRef] = useState<string | null>(null);
  // Reference images for pending assets (pre-generation, key = assetId)
  const [pendingRefs, setPendingRefs] = useState<Record<string, { url: string; name: string }[]>>({});
  const [uploadingPendingRef, setUploadingPendingRef] = useState<string | null>(null);
  // Scene references for pending assets (key = assetId, value = Set of referenced asset_codes)
  const [pendingSceneRefs, setPendingSceneRefs] = useState<Record<string, Set<string>>>({});
  const [showSceneRefDropdown, setShowSceneRefDropdown] = useState<string | null>(null);
  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<{ src: string; alt: string } | null>(null);
  // Scene selector for batch image generation
  const [showSceneSelector, setShowSceneSelector] = useState(false);
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(new Set());
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
      const loadedAssets = data.project?.assets ?? data.assets ?? [];
      setAssets(loadedAssets);
      // Pre-populate scene references from depends_on
      const initialSceneRefs: Record<string, Set<string>> = {};
      for (const a of loadedAssets) {
        if (a.depends_on && a.status === "pending") {
          initialSceneRefs[a.id] = new Set([a.depends_on]);
        }
      }
      if (Object.keys(initialSceneRefs).length > 0) {
        setPendingSceneRefs(initialSceneRefs);
      }
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

      let updatedPrompt: string | undefined;
      if (feedback && asset?.prompt_image) {
        updatedPrompt = `${asset.prompt_image}\n\n[FEEDBACK: ${feedback}]`;
      }

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
        setRejectNotes((prev) => { const next = { ...prev }; delete next[assetId]; return next; });

        try {
          await fetch("/api/dispatch/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assetId, provider }),
          });
        } catch { /* retry manually */ }
      }
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  /** Regenerate a specific image (1 or 2) for a scene — called from RejectModal */
  async function handleRegenerateImage(assetId: string, imageNumber: 1 | 2, modalText?: string, modalProvider?: string, modalCarry?: boolean) {
    const rejectKey = `${assetId}-${imageNumber}`;
    setActionLoading(assetId);
    try {
      const asset = assets.find((a) => a.id === assetId);
      const feedback = modalText?.trim() ?? rejectNotes[rejectKey]?.trim();
      const provider = modalProvider ?? regenImageProvider[rejectKey] ?? imageProvider;

      if (!feedback || feedback.length < 3) { setActionLoading(null); return; }

      // The modal text IS the full new prompt (user edited it directly)
      const promptField = imageNumber === 1 ? "prompt_image1" : "prompt_image2";
      const newPrompt = feedback;

      // Update the prompt in the DB
      await fetch(`/api/projects/${projectId}/assets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_ids: [assetId],
          updates: { [promptField]: newPrompt },
        }),
      });

      // Clear the corresponding image URL so it gets regenerated
      const clearField = imageNumber === 1 ? "image1_url" : "image2_url";
      await fetch(`/api/projects/${projectId}/assets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_ids: [assetId],
          updates: { [clearField]: null, status: "generating" },
        }),
      });

      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId
            ? { ...a, status: "generating", [clearField]: null, [promptField]: newPrompt, error_message: null }
            : a
        )
      );
      setShowRejectInput(null);
      setRejectNotes((prev) => { const next = { ...prev }; delete next[rejectKey]; return next; });
      setCarryReference((prev) => { const next = { ...prev }; delete next[rejectKey]; return next; });

      // Build extra reference images array
      const extraReferenceImages: string[] = [];
      const uploadedRefs = regenRefImages[rejectKey];
      if (uploadedRefs?.length) extraReferenceImages.push(...uploadedRefs.map((r) => r.url));
      setRegenRefImages((prev) => { const next = { ...prev }; delete next[rejectKey]; return next; });

      // Dispatch the specific image
      // If carryRef is on, the other image will be picked up by the dispatch API
      // since it reads image1_url/image2_url from the DB
      await fetch("/api/dispatch/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          provider,
          imageNumber,
          ...(extraReferenceImages.length > 0 && { extraReferenceImages }),
        }),
      });
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  /** Save inline prompt edit */
  async function handleSavePrompt(assetId: string, field: string, newValue: string) {
    try {
      await fetch(`/api/projects/${projectId}/assets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_ids: [assetId],
          updates: { [field]: newValue },
        }),
      });
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId ? { ...a, [field]: newValue } : a
        )
      );
    } catch { /* ignore */ }
    setEditingPrompt(null);
    setEditDraft("");
  }

  /** Undo scene approval → back to "ready" for adjustments */
  async function handleUndoApprove(assetId: string) {
    setActionLoading(assetId);
    try {
      await fetch(`/api/projects/${projectId}/assets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_ids: [assetId], updates: { status: "ready" } }),
      });
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, status: "ready" } : a))
      );
    } catch { /* ignore */ }
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

  async function handleDispatchImages(sceneSet?: Set<string>) {
    // Prevent double-clicks
    if (isDispatchingRef.current) return;

    // Find assets that need image generation:
    const pendingAssets = assets.filter((a) => {
      // If scene set provided, only include those scenes
      if (sceneSet && sceneSet.size > 0 && !sceneSet.has(a.asset_code)) return false;
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

    // Track freshly generated URLs so scene refs can use them mid-batch
    // (React state won't update during the loop)
    const freshUrls: Record<string, { img1?: string; img2?: string }> = {};
    // Pre-populate from existing asset state
    for (const a of assets) {
      const i1 = a.image1_url ?? a.image_url;
      if (i1 || a.image2_url) {
        freshUrls[a.asset_code] = { img1: i1 ?? undefined, img2: a.image2_url ?? undefined };
      }
    }

    /** Collect extra reference images for an asset, using freshUrls for latest data */
    function collectExtraRefs(assetId: string, assetCode: string): string[] {
      const refs: string[] = [];
      // Uploaded files
      if (pendingRefs[assetId]?.length) {
        refs.push(...pendingRefs[assetId].map((r) => r.url));
      }
      // Scene references — use freshUrls for latest generated images
      const sceneRefCodes = pendingSceneRefs[assetId];
      if (sceneRefCodes?.size) {
        for (const code of sceneRefCodes) {
          if (code === assetCode) continue; // skip self
          const fresh = freshUrls[code];
          if (fresh?.img1) refs.push(fresh.img1);
          if (fresh?.img2) refs.push(fresh.img2);
        }
      }
      return refs;
    }

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
          const extraRefs = collectExtraRefs(asset.id, asset.asset_code);

          const res = await fetch("/api/dispatch/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId: asset.id,
              provider,
              imageNumber: 1,
              ...(extraRefs.length > 0 && { extraReferenceImages: extraRefs }),
            }),
          });
          const data = await res.json();
          if (data.status === "failed") { failed++; continue; }
          if (data.status === "skipped") { skipped++; continue; }

          // Track the freshly generated URL
          if (data.url) {
            freshUrls[asset.asset_code] = { ...freshUrls[asset.asset_code], img1: data.url };
          }

          // Update local state so UI refreshes
          setAssets((prev) =>
            prev.map((a) =>
              a.id === asset.id
                ? { ...a, image_url: data.url, image1_url: data.url, status: data.needsImage2 ? "generating" : "ready" }
                : a
            )
          );

          // If image1 succeeded and there's a prompt_image2, generate image2 immediately
          if (data.status === "completed" && data.needsImage2) {
            setDispatchResult(
              `Cena ${i + 1}/${total} — gerando frame final... (${completed} ok, ${failed} falhas)`
            );
            // Re-collect refs (now includes this asset's own img1 via freshUrls)
            const extraRefs2 = collectExtraRefs(asset.id, asset.asset_code);

            const res2 = await fetch("/api/dispatch/images", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                assetId: asset.id,
                provider,
                imageNumber: 2,
                ...(extraRefs2.length > 0 && { extraReferenceImages: extraRefs2 }),
              }),
            });
            const data2 = await res2.json();
            if (data2.status === "completed") {
              completed++;
              if (data2.url) {
                freshUrls[asset.asset_code] = { ...freshUrls[asset.asset_code], img2: data2.url };
              }
              setAssets((prev) =>
                prev.map((a) =>
                  a.id === asset.id
                    ? { ...a, image2_url: data2.url, status: "ready" }
                    : a
                )
              );
            }
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
            <option value="google">Nano Banana Pro</option>
            <option value="imagen4">Imagen 4</option>
            <option value="higgsfield">Higgsfield</option>
            <option value="runway">Runway</option>
          </select>
          <div className="relative">
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
              onClick={() => {
                if (dispatching === "images") return;
                setShowSceneSelector(!showSceneSelector);
              }}
              disabled={dispatching !== null}
            >
              {dispatching === "images" ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
              )}
              Gerar Imagens {pendingCount > 0 && `(${pendingCount})`}
            </button>
            {/* Scene selector dropdown */}
            {showSceneSelector && (
              <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl">
                <p className="mb-2 text-xs font-semibold text-slate-400">Selecionar cenas para gerar:</p>
                <div className="mb-2 max-h-48 space-y-1 overflow-y-auto">
                  {assets
                    .filter((a) => a.status === "pending" && (a.prompt_image1 || a.prompt_image))
                    .map((a) => (
                      <label key={a.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">
                        <input
                          type="checkbox"
                          checked={selectedScenes.has(a.asset_code)}
                          onChange={(e) => {
                            setSelectedScenes((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(a.asset_code);
                              else next.delete(a.asset_code);
                              return next;
                            });
                          }}
                          className="rounded border-slate-600"
                        />
                        <span className="font-medium">{a.asset_code}</span>
                        <span className="truncate text-slate-500">{a.scenedescription ?? a.description ?? ""}</span>
                      </label>
                    ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const allPending = new Set(
                        assets.filter((a) => a.status === "pending" && (a.prompt_image1 || a.prompt_image)).map((a) => a.asset_code)
                      );
                      setSelectedScenes(allPending);
                    }}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] text-slate-300 hover:bg-slate-700"
                  >
                    Todas
                  </button>
                  <button
                    onClick={() => setSelectedScenes(new Set())}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] text-slate-300 hover:bg-slate-700"
                  >
                    Nenhuma
                  </button>
                  <button
                    onClick={() => {
                      setShowSceneSelector(false);
                      handleDispatchImages(selectedScenes.size > 0 ? selectedScenes : undefined);
                    }}
                    disabled={selectedScenes.size === 0}
                    className="flex-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-50"
                  >
                    Gerar ({selectedScenes.size})
                  </button>
                </div>
              </div>
            )}
          </div>
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
        <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
          <span className="h-2 w-2 rounded-full bg-green-400" />
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

      {/* Scene Cards — full width, one per row */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <p className="text-sm text-slate-400">
            Nenhum asset encontrado com os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((asset) => {
            const img1 = asset.image1_url ?? asset.image_url;
            const img2 = asset.image2_url;
            const hasImage2Prompt = !!(asset.prompt_image2?.trim());
            const isPending = asset.status === "pending";
            const isApproved = asset.status === "approved";
            const isReady = asset.status === "ready";
            const isFailed = asset.status === "failed" || asset.status === "rejected";
            const isGenerating = asset.status === "generating";
            const params = (asset.parameters ?? {}) as Record<string, string>;

            const DownloadBtn = ({ url, label }: { url: string; label: string }) => (
              <a href={url} download target="_blank" rel="noopener noreferrer"
                className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-white backdrop-blur-sm transition-all hover:bg-purple-600"
                title={`Baixar ${label}`}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </a>
            );

            /** Render the RejectModal portal for this asset's image */
            const renderRejectModal = (imgNum: 1 | 2) => {
              const key = `${asset.id}-${imgNum}`;
              if (showRejectInput !== key) return null;
              const otherImgNum = imgNum === 1 ? 2 : 1;
              const otherImg = imgNum === 1 ? img2 : img1;
              const currentPrompt = imgNum === 1
                ? (asset.prompt_image1 ?? asset.prompt_image ?? "")
                : (asset.prompt_image2 ?? "");

              return (
                <RejectModal
                  key={key}
                  assetCode={asset.asset_code}
                  imgNum={imgNum}
                  initialText={currentPrompt}
                  otherImgLabel={otherImg ? `imagem ${otherImgNum}` : null}
                  hasOtherImg={!!otherImg}
                  providers={[
                    { value: "google", label: "Nano Banana Pro" },
                    { value: "imagen4", label: "Imagen 4" },
                    { value: "higgsfield", label: "Higgsfield" },
                    { value: "runway", label: "Runway" },
                  ]}
                  defaultProvider={imageProvider}
                  uploadedRefs={regenRefImages[key] ?? []}
                  uploadingRef={uploadingRef === key}
                  onUploadRefs={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    setUploadingRef(key);
                    try {
                      const newRefs: { url: string; name: string }[] = [];
                      for (let fi = 0; fi < files.length; fi++) {
                        const file = files[fi];
                        const formData = new FormData();
                        formData.append("file", file);
                        const res = await fetch("/api/upload", { method: "POST", body: formData });
                        if (res.ok) {
                          const { url } = await res.json();
                          newRefs.push({ url, name: file.name });
                        }
                      }
                      if (newRefs.length > 0) {
                        setRegenRefImages((prev) => ({
                          ...prev,
                          [key]: [...(prev[key] ?? []), ...newRefs],
                        }));
                      }
                    } catch { /* ignore */ }
                    setUploadingRef(null);
                    e.target.value = "";
                  }}
                  onRemoveRef={(index) => setRegenRefImages((prev) => ({
                    ...prev,
                    [key]: (prev[key] ?? []).filter((_, i) => i !== index),
                  }))}
                  onLightboxRef={(url) => setLightboxSrc({ src: url, alt: "Referencia" })}
                  onSubmit={(text, provider, carry) => {
                    handleRegenerateImage(asset.id, imgNum, text, provider, carry);
                  }}
                  onClose={() => setShowRejectInput(null)}
                />
              );
            };

            return (
              <div
                key={asset.id}
                className={`overflow-hidden rounded-xl border transition-all ${
                  isApproved
                    ? "border-green-700/50 bg-green-950/30"
                    : "border-slate-800 bg-slate-900 hover:border-slate-700"
                }`}
              >
                <div className="flex flex-col lg:flex-row">
                  {/* Left: Images */}
                  <div className="relative flex min-h-[200px] flex-1 lg:min-h-[280px]">
                    {/* Image 1 — full width when no image2 prompt */}
                    <div className={`relative bg-slate-800 ${hasImage2Prompt ? "w-1/2 border-r border-slate-700/50" : "w-full"}`}>
                      {img1 ? (
                        <>
                          <img
                            src={img1} alt={`${asset.asset_code} - Frame Inicial`}
                            className="h-full w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                            onClick={() => setLightboxSrc({ src: img1, alt: `${asset.asset_code} - Frame Inicial` })}
                          />
                          <DownloadBtn url={img1} label="Frame Inicial" />
                        </>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="text-center">
                            <svg className="mx-auto h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                            </svg>
                            <p className="mt-1 text-[10px] text-slate-500">Frame Inicial</p>
                          </div>
                        </div>
                      )}
                      <span className="absolute bottom-2 left-2 rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-slate-200 backdrop-blur-sm">
                        Imagem 1{hasImage2Prompt ? " — Inicial" : ""}
                      </span>
                      {/* When no image2 prompt, show small badge */}
                      {!hasImage2Prompt && (
                        <span className="absolute bottom-2 right-2 rounded bg-slate-900/70 px-2 py-0.5 text-[9px] text-slate-500 backdrop-blur-sm">
                          Imagem 2 Nao Requisitada
                        </span>
                      )}
                    </div>

                    {/* Image 2 — only shown when prompt_image2 exists */}
                    {hasImage2Prompt && (
                      <div className="relative w-1/2 bg-slate-800">
                        {img2 ? (
                          <>
                            <img
                              src={img2} alt={`${asset.asset_code} - Frame Final`}
                              className="h-full w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                              onClick={() => setLightboxSrc({ src: img2, alt: `${asset.asset_code} - Frame Final` })}
                            />
                            <DownloadBtn url={img2} label="Frame Final" />
                          </>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <div className="text-center">
                              <svg className="mx-auto h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                              </svg>
                              <p className="mt-1 text-[10px] text-slate-500">Frame Final</p>
                            </div>
                          </div>
                        )}
                        <span className="absolute bottom-2 left-2 rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-slate-200 backdrop-blur-sm">
                          Imagem 2 — Final
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Info + Actions */}
                  <div className="flex w-full flex-col justify-between overflow-y-auto p-5 lg:w-[420px]">
                    {/* Header */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white">{asset.asset_code}</h3>
                        <AssetStatusBadge status={asset.status} />
                      </div>

                      {/* Scene info from CSV */}
                      <div className="mb-3 space-y-1.5">
                        {(asset.scenedescription || asset.description) && (
                          <p className="text-xs leading-relaxed text-slate-300">
                            {asset.scenedescription ?? asset.description}
                          </p>
                        )}
                        {asset.depends_on && (
                          <p className="text-[11px] text-purple-400">
                            Depende de: <span className="font-semibold">{asset.depends_on}</span>
                          </p>
                        )}
                      </div>

                      {/* CSV metadata with copy buttons for prompts */}
                      <div className="mb-3 space-y-1 rounded-lg bg-slate-800/60 p-2.5 text-[10px]">
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                          {asset.scene && asset.scene !== asset.asset_code && (
                            <><span className="text-slate-500">Cena</span><span className="text-slate-300">{asset.scene}</span></>
                          )}
                          {asset.asset_type && (
                            <><span className="text-slate-500">Tipo</span><span className="text-slate-300">{asset.asset_type}</span></>
                          )}
                          {params.duration && (
                            <><span className="text-slate-500">Duracao</span><span className="text-slate-300">{params.duration}s</span></>
                          )}
                        </div>
                        {/* Prompts with copy + edit buttons */}
                        {([
                          { label: "Prompt Img 1", field: "prompt_image1", value: asset.prompt_image1 ?? asset.prompt_image },
                          { label: "Prompt Img 2", field: "prompt_image2", value: asset.prompt_image2 },
                          { label: "Prompt Video", field: "prompt_video", value: asset.prompt_video },
                        ] as { label: string; field: string; value: string | null }[]).filter((p) => p.value).map((p, pi) => {
                          const editKey = `${asset.id}-${p.field}`;
                          const isEditing = editingPrompt === editKey;
                          return (
                            <div key={pi} className={`${pi === 0 ? "mt-1.5" : "mt-1"} border-t border-slate-700/50 pt-1.5`}>
                              <div className="flex items-start gap-1">
                                <span className="flex-shrink-0 text-slate-500">{p.label}</span>
                                <CopyBtn text={p.value!} />
                                <EditBtn onClick={() => {
                                  if (isEditing) { setEditingPrompt(null); setEditDraft(""); }
                                  else { setEditingPrompt(editKey); setEditDraft(p.value!); }
                                }} />
                              </div>
                              {isEditing ? (
                                <div className="mt-1 space-y-1.5">
                                  <textarea
                                    value={editDraft}
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    rows={4}
                                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-[11px] leading-relaxed text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                                  />
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => handleSavePrompt(asset.id, p.field, editDraft)}
                                      disabled={editDraft.trim() === p.value?.trim()}
                                      className="rounded bg-purple-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-purple-500 disabled:opacity-40"
                                    >
                                      Salvar
                                    </button>
                                    <button
                                      onClick={() => { setEditingPrompt(null); setEditDraft(""); }}
                                      className="rounded bg-slate-700 px-2.5 py-1 text-[10px] text-slate-300 hover:bg-slate-600"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-0.5 line-clamp-2 text-slate-400" title={p.value!}>
                                  {p.value!.length > 120 ? `${p.value!.slice(0, 120)}...` : p.value}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      {/* Error message */}
                      {asset.error_message && (
                        <p className="rounded bg-red-900/30 px-2 py-1 text-[10px] text-red-400">
                          {asset.error_message}
                        </p>
                      )}

                      {/* Pending: reference images upload + scene refs */}
                      {isPending && (() => {
                        const uploadedCount = pendingRefs[asset.id]?.length ?? 0;
                        const sceneRefSet = pendingSceneRefs[asset.id] ?? new Set<string>();
                        // Count scene ref images
                        let sceneRefImgCount = 0;
                        for (const code of sceneRefSet) {
                          const ra = assets.find((a) => a.asset_code === code);
                          if (ra) {
                            if (ra.image1_url ?? ra.image_url) sceneRefImgCount++;
                            if (ra.image2_url) sceneRefImgCount++;
                          }
                        }
                        const totalRefs = uploadedCount + sceneRefSet.size;
                        // All other scenes for the dropdown (including pending ones)
                        const otherScenes = assets.filter((a) => a.id !== asset.id);

                        return (
                          <div className="space-y-2">
                            <p className="text-[10px] font-medium text-slate-500">Referencias visuais (opcional)</p>

                            {/* Uploaded images row */}
                            <div className="flex flex-wrap gap-2">
                              {(pendingRefs[asset.id] ?? []).map((ref, ri) => (
                                <div key={`up-${ri}`} className="group relative">
                                  <img
                                    src={ref.url} alt={ref.name}
                                    className="h-12 w-12 cursor-pointer rounded border border-slate-600 object-cover"
                                    onClick={() => setLightboxSrc({ src: ref.url, alt: ref.name })}
                                  />
                                  <button
                                    onClick={() => setPendingRefs((prev) => ({
                                      ...prev,
                                      [asset.id]: (prev[asset.id] ?? []).filter((_, idx) => idx !== ri),
                                    }))}
                                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                                    title="Remover"
                                  >&times;</button>
                                </div>
                              ))}
                              {/* Scene ref thumbnails */}
                              {[...sceneRefSet].map((code) => {
                                const ra = assets.find((a) => a.asset_code === code);
                                const img = ra?.image1_url ?? ra?.image_url;
                                return (
                                  <div key={`sc-${code}`} className="group relative">
                                    {img ? (
                                      <img
                                        src={img} alt={code}
                                        className="h-12 w-12 cursor-pointer rounded border border-purple-500/50 object-cover ring-1 ring-purple-500/30"
                                        onClick={() => setLightboxSrc({ src: img, alt: code })}
                                      />
                                    ) : (
                                      <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-purple-500/40 bg-slate-800 text-[8px] font-bold text-purple-400">
                                        {code}
                                      </div>
                                    )}
                                    <span className="absolute bottom-0 left-0 right-0 truncate bg-slate-900/80 px-0.5 text-center text-[7px] font-bold text-purple-300">
                                      {code}
                                    </span>
                                    <button
                                      onClick={() => setPendingSceneRefs((prev) => {
                                        const next = new Set(prev[asset.id] ?? []);
                                        next.delete(code);
                                        return { ...prev, [asset.id]: next };
                                      })}
                                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                                      title="Remover cena"
                                    >&times;</button>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Buttons row */}
                            <div className="flex gap-2">
                              {/* Upload multiple images */}
                              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-600 px-2.5 py-1.5 text-[10px] text-slate-400 transition-colors hover:border-purple-500 hover:text-purple-300">
                                {uploadingPendingRef === asset.id ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-white" />
                                ) : (
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                                  </svg>
                                )}
                                Upload imagens
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={async (e) => {
                                    const files = e.target.files;
                                    if (!files || files.length === 0) return;
                                    setUploadingPendingRef(asset.id);
                                    const newRefs: { url: string; name: string }[] = [];
                                    for (let fi = 0; fi < files.length; fi++) {
                                      try {
                                        const formData = new FormData();
                                        formData.append("file", files[fi]);
                                        const res = await fetch("/api/upload", { method: "POST", body: formData });
                                        if (res.ok) {
                                          const { url } = await res.json();
                                          newRefs.push({ url, name: files[fi].name });
                                        }
                                      } catch { /* ignore */ }
                                    }
                                    if (newRefs.length > 0) {
                                      setPendingRefs((prev) => ({
                                        ...prev,
                                        [asset.id]: [...(prev[asset.id] ?? []), ...newRefs],
                                      }));
                                    }
                                    setUploadingPendingRef(null);
                                    e.target.value = "";
                                  }}
                                />
                              </label>

                              {/* Scene reference selector */}
                              {otherScenes.length > 0 && (
                                <div className="relative">
                                  <button
                                    onClick={() => setShowSceneRefDropdown(showSceneRefDropdown === asset.id ? null : asset.id)}
                                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-600 px-2.5 py-1.5 text-[10px] text-slate-400 transition-colors hover:border-purple-500 hover:text-purple-300"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                                    </svg>
                                    Cenas de referencia
                                    {sceneRefSet.size > 0 && (
                                      <span className="rounded-full bg-purple-600 px-1.5 text-[9px] font-bold text-white">{sceneRefSet.size}</span>
                                    )}
                                  </button>
                                  {showSceneRefDropdown === asset.id && (
                                    <div className="absolute left-0 top-full z-30 mt-1 max-h-52 w-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 p-1 shadow-xl">
                                      {otherScenes.map((other) => {
                                        const isSelected = sceneRefSet.has(other.asset_code);
                                        const thumb = other.image1_url ?? other.image_url;
                                        return (
                                          <button
                                            key={other.id}
                                            onClick={() => {
                                              setPendingSceneRefs((prev) => {
                                                const next = new Set(prev[asset.id] ?? []);
                                                if (isSelected) next.delete(other.asset_code);
                                                else next.add(other.asset_code);
                                                return { ...prev, [asset.id]: next };
                                              });
                                            }}
                                            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[10px] transition-colors ${
                                              isSelected ? "bg-purple-600/20 text-purple-300" : "text-slate-300 hover:bg-slate-700"
                                            }`}
                                          >
                                            {thumb ? (
                                              <img src={thumb} alt={other.asset_code} className="h-8 w-8 flex-shrink-0 rounded object-cover" />
                                            ) : (
                                              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-slate-700 text-[8px] text-slate-500">?</div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-semibold">{other.asset_code}</span>
                                                {!thumb && (
                                                  <span className="rounded bg-slate-700 px-1 text-[8px] text-slate-500">pendente</span>
                                                )}
                                              </div>
                                              {other.scenedescription && (
                                                <p className="truncate text-[9px] text-slate-500">{other.scenedescription}</p>
                                              )}
                                            </div>
                                            {isSelected && (
                                              <svg className="h-4 w-4 flex-shrink-0 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                              </svg>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {totalRefs > 0 && (
                              <p className="text-[9px] text-slate-600">
                                {uploadedCount > 0 && `${uploadedCount} upload(s)`}
                                {uploadedCount > 0 && sceneRefSet.size > 0 && " + "}
                                {sceneRefSet.size > 0 && `${sceneRefSet.size} cena(s)`}
                                {" "}— referencias enviadas na geracao
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Generating */}
                      {isGenerating && (
                        <div className="flex items-center gap-2 text-sm text-blue-400">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
                          Gerando imagens...
                        </div>
                      )}

                      {/* Ready: Approve + Reject per image */}
                      {isReady && (
                        <>
                          <button
                            onClick={() => handleApprove(asset.id)}
                            disabled={actionLoading === asset.id}
                            className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-50"
                          >
                            {actionLoading === asset.id ? (
                              <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                              "Aprovar Cena"
                            )}
                          </button>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowRejectInput(showRejectInput === `${asset.id}-1` ? null : `${asset.id}-1`)}
                              disabled={actionLoading === asset.id}
                              className="flex-1 rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/40 disabled:opacity-50"
                            >
                              Rejeitar Imagem 1
                            </button>
                            {hasImage2Prompt && (
                              <button
                                onClick={() => setShowRejectInput(showRejectInput === `${asset.id}-2` ? null : `${asset.id}-2`)}
                                disabled={actionLoading === asset.id}
                                className="flex-1 rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/40 disabled:opacity-50"
                              >
                                Rejeitar Imagem 2
                              </button>
                            )}
                          </div>
                          {renderRejectModal(1)}
                          {renderRejectModal(2)}
                        </>
                      )}

                      {/* Approved: green bg + Voltar button */}
                      {isApproved && (
                        <button
                          onClick={() => handleUndoApprove(asset.id)}
                          disabled={actionLoading === asset.id}
                          className="w-full rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
                        >
                          {actionLoading === asset.id ? (
                            <div className="mx-auto h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          ) : (
                            "Voltar para ajuste"
                          )}
                        </button>
                      )}

                      {/* Failed / Rejected */}
                      {isFailed && (
                        <>
                          {asset.review_notes && (
                            <p className="rounded bg-red-900/30 px-2 py-1 text-[10px] text-red-400">
                              Nota: {asset.review_notes}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowRejectInput(showRejectInput === `${asset.id}-1` ? null : `${asset.id}-1`)}
                              className="flex-1 rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-900/40"
                            >
                              Regenerar Imagem 1
                            </button>
                            {hasImage2Prompt && (
                              <button
                                onClick={() => setShowRejectInput(showRejectInput === `${asset.id}-2` ? null : `${asset.id}-2`)}
                                className="flex-1 rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-900/40"
                              >
                                Regenerar Imagem 2
                              </button>
                            )}
                          </div>
                          {renderRejectModal(1)}
                          {renderRejectModal(2)}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox overlay */}
      {lightboxSrc && (
        <Lightbox src={lightboxSrc.src} alt={lightboxSrc.alt} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
}

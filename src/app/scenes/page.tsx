"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";

interface SceneImage {
  url: string;
  metadata?: Record<string, unknown>;
}

interface Scene {
  scene_id: string;
  status: string;
  original_prompt: string;
  generated_images: SceneImage[];
  end_frame_prompt: string | null;
  end_frame_generated_images: SceneImage[];
  movement_prompt: string | null;
  approved_image_index: number | null;
  end_frame_approved_index: number | null;
  provider?: "higgsfield" | "google";
  video_url?: string | null;
  error_message?: string | null;
  video_config?: { model: string; duration: number };
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
  const router = useRouter();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  const fetchScenes = useCallback(() => {
    fetch("/api/scenes")
      .then((r) => r.json())
      .then((data) => setScenes(data.scenes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchScenes(); }, [fetchScenes]);

  const filtered =
    filter === "all" ? scenes : scenes.filter((s) => s.status === filter);

  // Quick approve: sets image index + end frame index, keeps movement prompt, status → approved
  async function handleQuickApprove(scene: Scene, optionIndex: number) {
    setApproving(`${scene.scene_id}-${optionIndex}`);
    try {
      const res = await fetch(`/api/scenes/${scene.scene_id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_index: optionIndex + 1, // 1-based
          end_frame_index: scene.end_frame_generated_images.length > optionIndex ? optionIndex + 1 : undefined,
          movement_prompt: scene.movement_prompt ?? "",
          video_model: scene.provider === "google" ? "veo-3.1" : "kling-3.0",
          duration: scene.provider === "google" ? 8 : 5,
        }),
      });
      if (res.ok) {
        fetchScenes(); // Refresh
      }
    } catch { /* ignore */ }
    setApproving(null);
  }

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
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-500"
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
                ? "bg-purple-600 text-white"
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
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-900" />
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
        <div className="space-y-4">
          {filtered.map((scene) => {
            const hasEndFrame = scene.end_frame_generated_images.length > 0;
            const variationCount = scene.generated_images.length;
            const isApproved = scene.status !== "images_generated";

            return (
              <div
                key={scene.scene_id}
                className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-white">{scene.scene_id}</h3>
                    <StatusBadge status={scene.status} />
                    {scene.provider && (
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        scene.provider === "google"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}>
                        {scene.provider === "google" ? "Google" : "Higgsfield"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Video production inline status */}
                    {scene.status === "video_submitted" && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-blue-400">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                        Gerando video...
                      </span>
                    )}
                    {scene.status === "completed" && scene.video_url && (
                      <a
                        href={scene.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-400 hover:text-purple-300 hover:underline"
                      >
                        Ver video
                      </a>
                    )}
                    {scene.status === "approved" && scene.error_message && (
                      <span className="text-xs text-red-400">
                        Falha no envio
                      </span>
                    )}
                    <Link
                      href={`/scenes/${scene.scene_id}`}
                      className="text-xs text-slate-400 hover:text-purple-400 transition-colors"
                    >
                      Editar / Detalhes →
                    </Link>
                  </div>
                </div>

                {/* Movement prompt (if set) */}
                {scene.movement_prompt && (
                  <div className="border-b border-slate-800/50 bg-slate-900/50 px-5 py-2.5">
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-blue-400">Prompt do vídeo:</span>{" "}
                      <span className="text-slate-400">
                        {scene.movement_prompt.length > 150
                          ? scene.movement_prompt.slice(0, 150) + "..."
                          : scene.movement_prompt}
                      </span>
                    </p>
                  </div>
                )}

                {/* Options */}
                <div className="p-5 space-y-4">
                  {Array.from({ length: variationCount }, (_, i) => {
                    const startImg = scene.generated_images[i]?.url;
                    const endImg = hasEndFrame ? scene.end_frame_generated_images[i]?.url : null;
                    const isThisApproved = isApproved && scene.approved_image_index === i + 1;
                    const isApprovingThis = approving === `${scene.scene_id}-${i}`;

                    return (
                      <div
                        key={i}
                        className={`rounded-lg border p-4 transition-colors ${
                          isThisApproved
                            ? "border-purple-600/50 bg-purple-900/10"
                            : "border-slate-800 bg-slate-900/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-bold text-slate-400">Opção {i + 1}</span>
                          {isThisApproved && (
                            <span className="rounded bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              APROVADA
                            </span>
                          )}
                        </div>

                        <div className="flex gap-4">
                          {/* Start frame */}
                          <div className="flex-1 space-y-1.5">
                            <span className="text-[10px] font-medium uppercase text-slate-500">Frame Inicial</span>
                            {startImg ? (
                              <div className="relative group">
                                <img
                                  src={startImg}
                                  alt={`Start ${i + 1}`}
                                  className="w-full aspect-video rounded-lg object-cover border border-slate-700"
                                />
                                <a
                                  href={startImg}
                                  download={`${scene.scene_id}-start-${i + 1}.png`}
                                  className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  ⬇ Baixar
                                </a>
                              </div>
                            ) : (
                              <div className="w-full aspect-video rounded-lg bg-slate-800 flex items-center justify-center text-xs text-slate-600">
                                Sem imagem
                              </div>
                            )}
                          </div>

                          {/* End frame */}
                          {hasEndFrame && (
                            <div className="flex-1 space-y-1.5">
                              <span className="text-[10px] font-medium uppercase text-slate-500">Frame Final</span>
                              {endImg ? (
                                <div className="relative group">
                                  <img
                                    src={endImg}
                                    alt={`End ${i + 1}`}
                                    className="w-full aspect-video rounded-lg object-cover border border-slate-700"
                                  />
                                  <a
                                    href={endImg}
                                    download={`${scene.scene_id}-end-${i + 1}.png`}
                                    className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    ⬇ Baixar
                                  </a>
                                </div>
                              ) : (
                                <div className="w-full aspect-video rounded-lg bg-slate-800 flex items-center justify-center text-xs text-slate-600">
                                  Sem imagem
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons for this option */}
                        {!isApproved && (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleQuickApprove(scene, i)}
                              disabled={isApprovingThis || !scene.movement_prompt}
                              className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isApprovingThis ? "Enviando..." : `Aprovar e Enviar Opção ${i + 1}`}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Scene-level actions */}
                  {!isApproved && !scene.movement_prompt && (
                    <p className="text-xs text-amber-400/80">
                      Sem prompt de vídeo definido. Adicione via ##sceneN no texto em lote ou edite a cena.
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/scenes/${scene.scene_id}`}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
                    >
                      Editar Cena
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import ImageGrid from "@/components/ImageGrid";
import VideoPlayer from "@/components/VideoPlayer";
import FrameCompare from "@/components/FrameCompare";
import ImprovePromptButton from "@/components/ImprovePromptButton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Scene {
  scene_id: string;
  provider?: "higgsfield" | "google";
  original_prompt: string;
  optimized_prompt: string;
  model_image: string;
  generated_images: { url: string; metadata?: Record<string, unknown> }[];
  approved_image_index: number | null;
  reference_images: string[];
  character_id: string | null;
  movement_prompt: string | null;
  optimized_movement_prompt: string | null;
  end_frame_prompt: string | null;
  end_frame_optimized_prompt: string | null;
  end_frame_model_image: string | null;
  end_frame_generated_images: { url: string; metadata?: Record<string, unknown> }[];
  end_frame_approved_index: number | null;
  end_frame_reference_images: string[];
  video_config: {
    model: string;
    duration: number;
    resolution: string;
    preset: string | null;
    end_frame: { type: string; image_url: string } | null;
  };
  status: string;
  request_id: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HIGGSFIELD_VIDEO_MODELS = [
  { value: "kling-3.0", label: "Kling 3.0" },
  { value: "kling-o1", label: "Kling O1" },
  { value: "kling-2.5-turbo", label: "Kling 2.5 Turbo" },
  { value: "dop-turbo", label: "DOP Turbo" },
  { value: "dop-lite", label: "DOP Lite" },
  { value: "dop-preview", label: "DOP Preview" },
];

const GOOGLE_VIDEO_MODELS = [
  { value: "veo-3.1", label: "Veo 3.1" },
  { value: "veo-3.1-fast", label: "Veo 3.1 Fast" },
];

const HIGGSFIELD_DURATIONS = [5, 10, 15];
const GOOGLE_DURATIONS = [4, 6, 8];

const CAMERA_PRESETS = [
  "Dolly In",
  "Dolly Out",
  "Dolly Left",
  "Dolly Right",
  "Pan Left",
  "Pan Right",
  "Tilt Up",
  "Tilt Down",
  "Crash Zoom In",
  "Crash Zoom Out",
  "360 Orbit",
  "Ballet Time",
  "FPV Drone",
  "Handheld",
  "Car Grip",
  "Snorricam",
  "Dutch Angle",
];

const IMAGE_MODELS = [
  { value: "nano-banana-pro", label: "Nano Banana Pro" },
  { value: "flux-pro-kontext-max", label: "Flux Pro Kontext Max" },
  { value: "seedream-v4", label: "Seedream v4" },
];

// ---------------------------------------------------------------------------
// Shared style classes
// ---------------------------------------------------------------------------

const inputClasses =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50";

const labelClasses = "mb-1 block text-xs font-medium text-slate-400";

const sectionHeadingClasses = "mb-4 text-lg font-semibold text-white";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SceneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sceneId = params.id as string;

  // ---- Core data ----------------------------------------------------------
  const [scene, setScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Image selection (0-based for ImageGrid) ----------------------------
  const [selectedStartIndex, setSelectedStartIndex] = useState<number | null>(null);
  const [selectedEndIndex, setSelectedEndIndex] = useState<number | null>(null);

  // ---- Approve form -------------------------------------------------------
  const [movementPrompt, setMovementPrompt] = useState("");
  const [videoModel, setVideoModel] = useState("kling-3.0");
  const [duration, setDuration] = useState(5);
  const [preset, setPreset] = useState("");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // ---- Regenerate form ----------------------------------------------------
  const [showRegenForm, setShowRegenForm] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState("");
  const [regenModel, setRegenModel] = useState("");
  const [regenVariations, setRegenVariations] = useState(3);
  const [regenTarget, setRegenTarget] = useState<"start" | "end">("start");
  const [regenerating, setRegenerating] = useState(false);

  // ---- Derived state ------------------------------------------------------
  const hasEndFrameImages = (scene?.end_frame_generated_images?.length ?? 0) > 0;
  const isImagesGenerated = scene?.status === "images_generated";
  const isApprovedOrSubmitted =
    scene?.status === "approved" || scene?.status === "video_submitted";

  // Provider-aware video config options
  const isGoogle = scene?.provider === "google";
  const videoModels = isGoogle ? GOOGLE_VIDEO_MODELS : HIGGSFIELD_VIDEO_MODELS;
  const videoDurations = isGoogle ? GOOGLE_DURATIONS : HIGGSFIELD_DURATIONS;

  // Resolved selected image URLs for preview
  const startImageUrl =
    selectedStartIndex !== null && scene
      ? scene.generated_images[selectedStartIndex]?.url ?? null
      : null;
  const endImageUrl =
    selectedEndIndex !== null && scene
      ? scene.end_frame_generated_images[selectedEndIndex]?.url ?? null
      : null;

  // ---- Data fetching ------------------------------------------------------

  useEffect(() => {
    async function fetchScene() {
      try {
        setLoading(true);
        const res = await fetch(`/api/scenes/${sceneId}`);
        if (!res.ok) {
          throw new Error(
            res.status === 404 ? "Cena nao encontrada" : "Erro ao carregar cena"
          );
        }
        const data = await res.json();
        setScene(data.scene);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar cena");
      } finally {
        setLoading(false);
      }
    }

    if (sceneId) fetchScene();
  }, [sceneId]);

  // ---- Handlers -----------------------------------------------------------

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();

    if (selectedStartIndex === null) {
      setApproveError("Selecione uma imagem do frame inicial antes de aprovar.");
      return;
    }

    if (!movementPrompt.trim()) {
      setApproveError("O prompt de movimento e obrigatorio.");
      return;
    }

    setApproving(true);
    setApproveError(null);

    try {
      const body: Record<string, unknown> = {
        image_index: selectedStartIndex + 1,
        movement_prompt: movementPrompt.trim(),
        video_model: videoModel,
        duration,
      };

      if (selectedEndIndex !== null) {
        body.end_frame_index = selectedEndIndex + 1;
      }

      if (preset) {
        body.preset = preset;
      }

      const res = await fetch(`/api/scenes/${sceneId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setApproveError(data.error ?? "Erro ao aprovar cena");
        return;
      }

      setScene(data.scene);
    } catch {
      setApproveError("Erro de rede. Tente novamente.");
    } finally {
      setApproving(false);
    }
  }

  async function handleRegenerate(e: React.FormEvent) {
    e.preventDefault();
    setRegenerating(true);

    try {
      const body: Record<string, unknown> = {
        num_variations: regenVariations,
      };

      if (regenPrompt.trim()) {
        body.new_prompt = regenPrompt.trim();
      }

      if (regenModel) {
        body.new_model = regenModel;
      }

      if (regenTarget === "end") {
        body.target = "end";
      }

      const res = await fetch(`/api/scenes/${sceneId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? "Erro ao regenerar cena");
        return;
      }

      setScene(data.scene);
      setShowRegenForm(false);

      // Reset the index for whichever frame was regenerated
      if (regenTarget === "end") {
        setSelectedEndIndex(null);
      } else {
        setSelectedStartIndex(null);
      }

      setRegenPrompt("");
      setRegenModel("");
    } catch {
      alert("Erro de rede. Tente novamente.");
    } finally {
      setRegenerating(false);
    }
  }

  // ---- Loading & error states ---------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
          <p className="text-sm text-slate-400">Carregando cena...</p>
        </div>
      </div>
    );
  }

  if (error || !scene) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-6 text-center">
          <p className="text-sm text-red-400">{error ?? "Cena nao encontrada"}</p>
          <button
            onClick={() => router.push("/scenes")}
            className="mt-3 text-sm text-red-300 underline hover:text-red-200"
          >
            Voltar para cenas
          </button>
        </div>
      </div>
    );
  }

  // ---- Render -------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* ================================================================= */}
      {/* HEADER                                                            */}
      {/* ================================================================= */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{scene.scene_id}</h1>
            <StatusBadge status={scene.status} />
            <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
              scene.provider === "google"
                ? "bg-blue-900/50 text-blue-400"
                : "bg-amber-900/50 text-amber-400"
            }`}>
              {scene.provider === "google" ? "Google" : "Higgsfield"}
            </span>
          </div>
          <p className="max-w-2xl text-sm text-slate-400">{scene.original_prompt}</p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span>Modelo: {scene.model_image}</span>
            <span>
              Criado em: {new Date(scene.created_at).toLocaleDateString("pt-BR")}
            </span>
            {scene.character_id && <span>Personagem: {scene.character_id}</span>}
          </div>
        </div>

        <button
          onClick={() => setShowRegenForm(!showRegenForm)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
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
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
            />
          </svg>
          Regenerar
        </button>
      </div>

      {/* ================================================================= */}
      {/* REGENERATE FORM                                                   */}
      {/* ================================================================= */}
      {showRegenForm && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">
            Regenerar Imagens
          </h3>
          <form onSubmit={handleRegenerate} className="space-y-4">
            {/* Target selector — only if end frame images exist */}
            {hasEndFrameImages && (
              <div>
                <label htmlFor="regen-target" className={labelClasses}>
                  Frame Alvo
                </label>
                <select
                  id="regen-target"
                  value={regenTarget}
                  onChange={(e) =>
                    setRegenTarget(e.target.value as "start" | "end")
                  }
                  disabled={regenerating}
                  className={inputClasses}
                >
                  <option value="start">Frame Inicial</option>
                  <option value="end">Frame Final</option>
                </select>
              </div>
            )}

            {/* Prompt */}
            <div>
              <label htmlFor="regen-prompt" className={labelClasses}>
                Novo Prompt (opcional — usa o anterior se vazio)
              </label>
              <textarea
                id="regen-prompt"
                value={regenPrompt}
                onChange={(e) => setRegenPrompt(e.target.value)}
                placeholder={
                  regenTarget === "end" && scene.end_frame_optimized_prompt
                    ? scene.end_frame_optimized_prompt
                    : scene.optimized_prompt
                }
                rows={3}
                disabled={regenerating}
                className={inputClasses}
              />
            </div>

            {/* Model + Variations */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="regen-model" className={labelClasses}>
                  Modelo (opcional)
                </label>
                <select
                  id="regen-model"
                  value={regenModel}
                  onChange={(e) => setRegenModel(e.target.value)}
                  disabled={regenerating}
                  className={inputClasses}
                >
                  <option value="">Manter atual ({scene.model_image})</option>
                  {IMAGE_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="regen-variations" className={labelClasses}>
                  Variacoes
                </label>
                <select
                  id="regen-variations"
                  value={regenVariations}
                  onChange={(e) => setRegenVariations(Number(e.target.value))}
                  disabled={regenerating}
                  className={inputClasses}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={regenerating}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
              >
                {regenerating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
                    Regenerando...
                  </>
                ) : (
                  "Regenerar"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowRegenForm(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-300"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* START FRAME IMAGES                                                */}
      {/* ================================================================= */}
      {scene.generated_images.length > 0 && (
        <div>
          <h2 className={sectionHeadingClasses}>Imagens do Frame Inicial</h2>
          <ImageGrid
            images={scene.generated_images}
            selectedIndex={
              isImagesGenerated
                ? selectedStartIndex
                : scene.approved_image_index != null
                  ? scene.approved_image_index - 1
                  : null
            }
            onSelect={(index: number) => {
              if (isImagesGenerated) {
                setSelectedStartIndex(index);
              }
            }}
          />
        </div>
      )}

      {/* ================================================================= */}
      {/* END FRAME IMAGES                                                  */}
      {/* ================================================================= */}
      {hasEndFrameImages && (
        <div>
          <h2 className={sectionHeadingClasses}>Imagens do Frame Final</h2>
          <ImageGrid
            images={scene.end_frame_generated_images}
            selectedIndex={
              isImagesGenerated
                ? selectedEndIndex
                : scene.end_frame_approved_index != null
                  ? scene.end_frame_approved_index - 1
                  : null
            }
            onSelect={(index: number) => {
              if (isImagesGenerated) {
                setSelectedEndIndex(index);
              }
            }}
          />
        </div>
      )}

      {/* ================================================================= */}
      {/* FRAME PREVIEW (when at least start frame is selected)             */}
      {/* ================================================================= */}
      {isImagesGenerated && startImageUrl && (
        <div>
          <h2 className={sectionHeadingClasses}>Preview dos Frames Selecionados</h2>
          <FrameCompare
            startImageUrl={startImageUrl}
            endImageUrl={endImageUrl}
          />
        </div>
      )}

      {/* ================================================================= */}
      {/* APPROVE FORM                                                      */}
      {/* ================================================================= */}
      {isImagesGenerated && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h3 className={sectionHeadingClasses}>Aprovar Cena</h3>
          <form onSubmit={handleApprove} className="space-y-4">
            {/* Selection indicators */}
            <div className="space-y-2">
              {/* Start frame indicator */}
              <div className="rounded-lg bg-slate-800/50 px-4 py-3 text-sm">
                {selectedStartIndex !== null ? (
                  <span className="text-emerald-400">
                    Frame inicial: Variacao {selectedStartIndex + 1} selecionada
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Clique em uma imagem do frame inicial para seleciona-la
                  </span>
                )}
              </div>

              {/* End frame indicator — only if end frame images exist */}
              {hasEndFrameImages && (
                <div className="rounded-lg bg-slate-800/50 px-4 py-3 text-sm">
                  {selectedEndIndex !== null ? (
                    <span className="text-emerald-400">
                      Frame final: Variacao {selectedEndIndex + 1} selecionada
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      Clique em uma imagem do frame final para seleciona-la
                      (opcional)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Movement prompt with ImprovePromptButton */}
            <div>
              <label
                htmlFor="movement-prompt"
                className="mb-1 block text-sm font-medium text-slate-300"
              >
                Prompt de Movimento
              </label>
              <div className="space-y-2">
                <textarea
                  id="movement-prompt"
                  value={movementPrompt}
                  onChange={(e) => setMovementPrompt(e.target.value)}
                  placeholder="Descreva o que deve acontecer na cena: movimentos, transicoes, efeitos..."
                  rows={3}
                  disabled={approving}
                  className={inputClasses}
                />
                <ImprovePromptButton
                  prompt={movementPrompt}
                  context="video"
                  onImproved={(improved) => setMovementPrompt(improved)}
                  disabled={approving}
                />
              </div>
            </div>

            {/* Video config row */}
            <div className={`grid grid-cols-1 gap-4 ${isGoogle ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
              <div>
                <label htmlFor="video-model" className={labelClasses}>
                  Modelo de Video
                </label>
                <select
                  id="video-model"
                  value={videoModel}
                  onChange={(e) => setVideoModel(e.target.value)}
                  disabled={approving}
                  className={inputClasses}
                >
                  {videoModels.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="duration" className={labelClasses}>
                  Duracao
                </label>
                <select
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  disabled={approving}
                  className={inputClasses}
                >
                  {videoDurations.map((d) => (
                    <option key={d} value={d}>
                      {d} segundos
                    </option>
                  ))}
                </select>
              </div>
              {!isGoogle && (
              <div>
                <label htmlFor="preset" className={labelClasses}>
                  Preset de Camera (opcional)
                </label>
                <select
                  id="preset"
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                  disabled={approving}
                  className={inputClasses}
                >
                  <option value="">Nenhum</option>
                  {CAMERA_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              )}
            </div>

            {/* Error */}
            {approveError && (
              <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
                {approveError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={approving || selectedStartIndex === null}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {approving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                  Aprovando...
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
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                  Aprovar Cena
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* APPROVED CONFIG                                                   */}
      {/* ================================================================= */}
      {isApprovedOrSubmitted && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h3 className={sectionHeadingClasses}>Configuracao Aprovada</h3>

          {/* Grid of config values */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Imagem Inicial Selecionada
              </p>
              <p className="mt-1 text-sm text-white">
                Variacao {scene.approved_image_index}
              </p>
            </div>
            {scene.end_frame_approved_index != null && (
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Imagem Final Selecionada
                </p>
                <p className="mt-1 text-sm text-white">
                  Variacao {scene.end_frame_approved_index}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-slate-500">
                Modelo de Video
              </p>
              <p className="mt-1 text-sm text-white">
                {scene.video_config.model}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Duracao</p>
              <p className="mt-1 text-sm text-white">
                {scene.video_config.duration}s
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Preset</p>
              <p className="mt-1 text-sm text-white">
                {scene.video_config.preset ?? "Nenhum"}
              </p>
            </div>
          </div>

          {/* Movement prompt */}
          {scene.movement_prompt && (
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500">
                Prompt de Movimento
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {scene.movement_prompt}
              </p>
            </div>
          )}

          {/* Optimized movement prompt (if different) */}
          {scene.optimized_movement_prompt &&
            scene.optimized_movement_prompt !== scene.movement_prompt && (
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-500">
                  Prompt de Movimento (Otimizado)
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {scene.optimized_movement_prompt}
                </p>
              </div>
            )}

          {/* End frame info */}
          {scene.video_config.end_frame && (
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500">End Frame</p>
              <p className="mt-1 text-sm text-slate-300">
                Tipo: {scene.video_config.end_frame.type}
              </p>
            </div>
          )}

          {/* Frame preview for approved config */}
          {scene.approved_image_index != null && (
            <div className="mt-6">
              <p className="mb-3 text-xs font-medium text-slate-500">
                Preview dos Frames Aprovados
              </p>
              <FrameCompare
                startImageUrl={
                  scene.generated_images[scene.approved_image_index - 1]?.url ?? ""
                }
                endImageUrl={
                  scene.end_frame_approved_index != null
                    ? scene.end_frame_generated_images[
                        scene.end_frame_approved_index - 1
                      ]?.url ?? null
                    : null
                }
              />
            </div>
          )}

          {/* Request ID */}
          {scene.request_id && (
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500">Request ID</p>
              <p className="mt-1 font-mono text-xs text-slate-400">
                {scene.request_id}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* COMPLETED VIDEO                                                   */}
      {/* ================================================================= */}
      {scene.status === "completed" && scene.video_url && (
        <div>
          <h2 className={sectionHeadingClasses}>Video Final</h2>
          <VideoPlayer url={scene.video_url} title={scene.original_prompt} />
        </div>
      )}
    </div>
  );
}

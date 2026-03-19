"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import ImprovePromptButton from "@/components/ImprovePromptButton";
import VideoPlayer from "@/components/VideoPlayer";

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

const RUNWAY_VIDEO_MODELS = [
  { value: "gen4.5", label: "Gen 4.5 Turbo" },
];
const RUNWAY_DURATIONS = [5, 10];

const HIGGSFIELD_DURATIONS = [5, 10, 15];
// Image-to-video com Veo 3.1 so suporta 8s
const GOOGLE_DURATIONS = [8];

const CAMERA_PRESETS = [
  "Dolly In", "Dolly Out", "Dolly Left", "Dolly Right",
  "Pan Left", "Pan Right", "Tilt Up", "Tilt Down",
  "Crash Zoom In", "Crash Zoom Out", "360 Orbit",
  "Ballet Time", "FPV Drone", "Handheld",
  "Car Grip", "Snorricam", "Dutch Angle",
];

export default function VideoSubmitPage() {
  const [provider, setProvider] = useState<"higgsfield" | "google" | "runway">("google");
  const [startImageUrl, setStartImageUrl] = useState("");
  const [endImageUrl, setEndImageUrl] = useState("");
  const [startPreview, setStartPreview] = useState<string | null>(null);
  const [endPreview, setEndPreview] = useState<string | null>(null);
  const [movementPrompt, setMovementPrompt] = useState("");
  const [model, setModel] = useState("veo-3.1");
  const [duration, setDuration] = useState(8);
  const [preset, setPreset] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ request_id: string; scene_id?: string; video_url?: string; status?: string } | null>(null);
  const [uploadingStart, setUploadingStart] = useState(false);
  const [uploadingEnd, setUploadingEnd] = useState(false);
  const [startUploadError, setStartUploadError] = useState<string | null>(null);
  const [endUploadError, setEndUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const startFileRef = useRef<HTMLInputElement>(null);
  const endFileRef = useRef<HTMLInputElement>(null);

  // Provider-aware options
  const isGoogle = provider === "google";
  const isRunway = provider === "runway";
  const videoModels = isRunway ? RUNWAY_VIDEO_MODELS : isGoogle ? GOOGLE_VIDEO_MODELS : HIGGSFIELD_VIDEO_MODELS;
  const videoDurations = isRunway ? RUNWAY_DURATIONS : isGoogle ? GOOGLE_DURATIONS : HIGGSFIELD_DURATIONS;

  function handleProviderChange(newProvider: "higgsfield" | "google" | "runway") {
    setProvider(newProvider);
    // Reset model and duration to first option of the new provider
    if (newProvider === "google") {
      setModel("veo-3.1");
      setDuration(8);
      setPreset("");
    } else if (newProvider === "runway") {
      setModel("gen4.5");
      setDuration(5);
      setPreset("");
    } else {
      setModel("kling-3.0");
      setDuration(5);
    }
  }

  async function uploadFile(
    file: File,
    setUrl: (u: string) => void,
    setPreview: (p: string) => void,
    setLoading: (l: boolean) => void,
    setUploadError: (e: string | null) => void
  ) {
    setLoading(true);
    setUploadError(null);

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Check file size (Vercel limit ~4.5MB for API routes)
    if (file.size > 4 * 1024 * 1024) {
      setUploadError("Imagem muito grande (max 4MB). Reduza o tamanho e tente novamente.");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setUrl(data.url);
        } else {
          setUploadError("Upload retornou sem URL. Tente novamente.");
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setUploadError(errData.error || `Falha ao enviar imagem (${res.status})`);
      }
    } catch {
      setUploadError("Erro de rede ao enviar imagem. Verifique sua conexao.");
    } finally {
      setLoading(false);
    }
  }

  function clearStart() {
    setStartImageUrl("");
    setStartPreview(null);
    setStartUploadError(null);
    if (startFileRef.current) startFileRef.current.value = "";
  }

  function clearEnd() {
    setEndImageUrl("");
    setEndPreview(null);
    setEndUploadError(null);
    if (endFileRef.current) endFileRef.current.value = "";
  }

  async function handleSubmit() {
    if (!startImageUrl || !movementPrompt.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/videos/submit-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_image_url: startImageUrl,
          end_image_url: endImageUrl || undefined,
          movement_prompt: movementPrompt.trim(),
          model,
          duration,
          preset: preset || undefined,
          provider,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult({ request_id: data.request_id, scene_id: data.scene_id, status: "submitted" });
      } else {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data.error || `Erro ao enviar video (${res.status})`);
      }
    } catch {
      setSubmitError("Erro de rede ao enviar video. Verifique sua conexao.");
    } finally {
      setSubmitting(false);
    }
  }

  // Poll video status when we have a scene_id
  const pollVideoStatus = useCallback(async () => {
    if (!result?.scene_id || result.status === "completed" || result.status === "failed") return;
    try {
      const res = await fetch(`/api/scenes/${result.scene_id}/video-status`);
      if (!res.ok) return;
      const data = await res.json();
      const scene = data.scene;
      if (scene?.status === "completed" && scene?.video_url) {
        setResult((prev) => prev ? { ...prev, status: "completed", video_url: scene.video_url } : prev);
      } else if (scene?.status === "approved" && scene?.error_message) {
        setResult((prev) => prev ? { ...prev, status: "failed" } : prev);
      }
    } catch {
      // Ignore polling errors
    }
  }, [result?.scene_id, result?.status]);

  useEffect(() => {
    if (!result?.scene_id || result.status === "completed" || result.status === "failed") return;
    // Poll immediately, then every 15s
    pollVideoStatus();
    const interval = setInterval(pollVideoStatus, 15_000);
    return () => clearInterval(interval);
  }, [result?.scene_id, result?.status, pollVideoStatus]);

  const startReady = !!startImageUrl;
  const canSubmit = startReady && !!movementPrompt.trim() && !submitting;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Video Direto</h1>
        <p className="mt-1 text-sm text-slate-400">
          Envie imagens prontas e gere um video diretamente
        </p>
      </div>

      <div className="space-y-6">
        {/* Provider Toggle */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Provider</label>
          <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => handleProviderChange("google")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                provider === "google"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => handleProviderChange("higgsfield")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                provider === "higgsfield"
                  ? "bg-amber-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Higgsfield
            </button>
            <button
              type="button"
              onClick={() => handleProviderChange("runway")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                provider === "runway"
                  ? "bg-purple-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Runway
            </button>
          </div>
        </div>

        {/* Start/End Frame Uploads */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Start Frame */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400">Frame Inicial *</label>
            <div
              onClick={() => !uploadingStart && startFileRef.current?.click()}
              className={`relative flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
                startReady
                  ? "border-purple-500/50"
                  : startUploadError
                    ? "border-red-500/50"
                    : startPreview
                      ? "border-amber-500/50"
                      : "border-slate-700 hover:border-slate-600"
              }`}
            >
              {startPreview ? (
                <div className="aspect-video w-full">
                  <img src={startPreview} alt="Start frame" className="h-full w-full object-cover" />
                  {/* Status overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                    {uploadingStart ? (
                      <div className="flex items-center gap-2 text-xs text-amber-400">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
                        Enviando para Higgsfield...
                      </div>
                    ) : startReady ? (
                      <span className="text-xs text-purple-400">Enviado com sucesso</span>
                    ) : startUploadError ? (
                      <span className="text-xs text-red-400">Falha — clique para tentar novamente</span>
                    ) : null}
                  </div>
                  {/* Clear button */}
                  {!uploadingStart && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearStart(); }}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white/80 hover:bg-black/80 hover:text-white"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-slate-500">
                  {uploadingStart ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-purple-400" />
                  ) : (
                    <>
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                      <span className="text-xs">Clique para enviar</span>
                    </>
                  )}
                </div>
              )}
            </div>
            {startUploadError && (
              <p className="text-xs text-red-400">{startUploadError}</p>
            )}
            <input ref={startFileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], setStartImageUrl, setStartPreview, setUploadingStart, setStartUploadError)} />
          </div>

          {/* End Frame */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400">Frame Final (opcional)</label>
            <div
              onClick={() => !uploadingEnd && endFileRef.current?.click()}
              className={`relative flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
                endImageUrl
                  ? "border-purple-500/50"
                  : endUploadError
                    ? "border-red-500/50"
                    : endPreview
                      ? "border-amber-500/50"
                      : "border-slate-700 hover:border-slate-600"
              }`}
            >
              {endPreview ? (
                <div className="aspect-video w-full">
                  <img src={endPreview} alt="End frame" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                    {uploadingEnd ? (
                      <div className="flex items-center gap-2 text-xs text-amber-400">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
                        Enviando para Higgsfield...
                      </div>
                    ) : endImageUrl ? (
                      <span className="text-xs text-purple-400">Enviado com sucesso</span>
                    ) : endUploadError ? (
                      <span className="text-xs text-red-400">Falha — clique para tentar novamente</span>
                    ) : null}
                  </div>
                  {!uploadingEnd && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearEnd(); }}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white/80 hover:bg-black/80 hover:text-white"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-slate-500">
                  {uploadingEnd ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-purple-400" />
                  ) : (
                    <>
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                      <span className="text-xs">Clique para enviar (opcional)</span>
                    </>
                  )}
                </div>
              )}
            </div>
            {endUploadError && (
              <p className="text-xs text-red-400">{endUploadError}</p>
            )}
            <input ref={endFileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], setEndImageUrl, setEndPreview, setUploadingEnd, setEndUploadError)} />
          </div>
        </div>

        {/* Movement Prompt */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-400">Prompt de Movimento *</label>
            <ImprovePromptButton prompt={movementPrompt} context="video" onImproved={setMovementPrompt} />
          </div>
          <textarea
            rows={4}
            value={movementPrompt}
            onChange={(e) => setMovementPrompt(e.target.value)}
            placeholder="Descreva o que deve acontecer na cena..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        {/* Video Config */}
        <div className={`grid gap-4 ${isGoogle || isRunway ? "grid-cols-2" : "grid-cols-3"}`}>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Modelo</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500">
              {videoModels.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Duracao</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500">
              {videoDurations.map((d) => <option key={d} value={d}>{d} segundos</option>)}
            </select>
          </div>
          {!isGoogle && !isRunway && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Preset Camera</label>
            <select value={preset} onChange={(e) => setPreset(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500">
              <option value="">Nenhum</option>
              {CAMERA_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          )}
        </div>

        {/* Submit Error */}
        {submitError && (
          <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {submitError}
          </div>
        )}

        {/* Submit hint when not ready */}
        {!startReady && startPreview && !uploadingStart && (
          <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 px-4 py-3 text-xs text-amber-400">
            O upload do frame inicial falhou. Clique na imagem para tentar novamente, ou escolha outra imagem.
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Enviando video...
            </span>
          ) : !startReady ? (
            "Envie o frame inicial para continuar"
          ) : !movementPrompt.trim() ? (
            "Preencha o prompt de movimento"
          ) : (
            "Enviar Video"
          )}
        </button>

        {/* Result */}
        {result && (
          <div className={`space-y-3 rounded-xl border p-6 ${
            result.status === "completed"
              ? "border-purple-700 bg-purple-900/20"
              : result.status === "failed"
                ? "border-red-700 bg-red-900/20"
                : "border-blue-700 bg-blue-900/20"
          }`}>
            {result.status === "completed" ? (
              <>
                <h3 className="text-sm font-semibold text-purple-400">Video Concluido!</h3>
                {result.video_url && <VideoPlayer url={result.video_url} title="Video Direto" />}
                {result.scene_id && (
                  <Link
                    href={`/scenes/${result.scene_id}`}
                    className="inline-block text-xs text-purple-400 hover:text-purple-300 hover:underline"
                  >
                    Ver na pagina da cena →
                  </Link>
                )}
              </>
            ) : result.status === "failed" ? (
              <>
                <h3 className="text-sm font-semibold text-red-400">Falha na geracao do video</h3>
                <p className="text-xs text-red-300">
                  Verifique os detalhes na pagina da cena.
                </p>
                {result.scene_id && (
                  <Link
                    href={`/scenes/${result.scene_id}`}
                    className="inline-block text-xs text-red-400 hover:text-red-300 hover:underline"
                  >
                    Ver detalhes →
                  </Link>
                )}
              </>
            ) : (
              <>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                  Video em producao...
                </h3>
                <p className="text-xs text-blue-300/70">
                  O video esta sendo gerado. Esta pagina verifica o status automaticamente a cada 15 segundos.
                </p>
                <p className="text-xs text-slate-400">
                  Request ID: <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-blue-400">{result.request_id}</code>
                </p>
                <div className="flex gap-3">
                  {result.scene_id && (
                    <Link
                      href={`/scenes/${result.scene_id}`}
                      className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      Ver cena →
                    </Link>
                  )}
                  <Link
                    href="/batch"
                    className="text-xs text-slate-400 hover:text-slate-300 hover:underline"
                  >
                    Monitor de Producao →
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

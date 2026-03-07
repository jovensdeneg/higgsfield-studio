"use client";

import { useState, useRef } from "react";
import ImprovePromptButton from "@/components/ImprovePromptButton";
import VideoPlayer from "@/components/VideoPlayer";

const VIDEO_MODELS = [
  { value: "kling-3.0", label: "Kling 3.0" },
  { value: "kling-o1", label: "Kling O1" },
  { value: "kling-2.5-turbo", label: "Kling 2.5 Turbo" },
];

const CAMERA_PRESETS = [
  "", "Dolly In", "Dolly Out", "Dolly Left", "Dolly Right",
  "Pan Left", "Pan Right", "Tilt Up", "Tilt Down",
  "Crash Zoom In", "Crash Zoom Out", "360 Orbit",
  "Ballet Time", "FPV Drone", "Handheld",
  "Car Grip", "Snorricam", "Dutch Angle",
];

export default function VideoSubmitPage() {
  const [startImageUrl, setStartImageUrl] = useState("");
  const [endImageUrl, setEndImageUrl] = useState("");
  const [startPreview, setStartPreview] = useState<string | null>(null);
  const [endPreview, setEndPreview] = useState<string | null>(null);
  const [movementPrompt, setMovementPrompt] = useState("");
  const [model, setModel] = useState("kling-3.0");
  const [duration, setDuration] = useState(5);
  const [preset, setPreset] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ request_id: string; video_url?: string; status?: string } | null>(null);
  const [uploadingStart, setUploadingStart] = useState(false);
  const [uploadingEnd, setUploadingEnd] = useState(false);
  const startFileRef = useRef<HTMLInputElement>(null);
  const endFileRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File, setUrl: (u: string) => void, setPreview: (p: string) => void, setLoading: (l: boolean) => void) {
    setLoading(true);
    // Show local preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setUrl(data.url);
      } else {
        alert("Falha ao enviar imagem");
      }
    } catch { alert("Erro de rede"); }
    finally { setLoading(false); }
  }

  async function handleSubmit() {
    if (!startImageUrl || !movementPrompt.trim() || submitting) return;
    setSubmitting(true);
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
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult({ request_id: data.request_id, status: "submitted" });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Erro ao enviar vídeo");
      }
    } catch { alert("Erro de rede"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Vídeo Direto</h1>
        <p className="mt-1 text-sm text-slate-400">
          Envie imagens prontas e gere um vídeo diretamente
        </p>
      </div>

      <div className="space-y-6">
        {/* Start/End Frame Uploads */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Start Frame */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400">Frame Inicial *</label>
            <div
              onClick={() => !uploadingStart && startFileRef.current?.click()}
              className={`flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
                startPreview ? "border-emerald-500/50" : "border-slate-700 hover:border-slate-600"
              }`}
            >
              {startPreview ? (
                <div className="aspect-video w-full">
                  <img src={startPreview} alt="Start frame" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-slate-500">
                  {uploadingStart ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
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
            <input ref={startFileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], setStartImageUrl, setStartPreview, setUploadingStart)} />
          </div>

          {/* End Frame */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400">Frame Final (opcional)</label>
            <div
              onClick={() => !uploadingEnd && endFileRef.current?.click()}
              className={`flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
                endPreview ? "border-emerald-500/50" : "border-slate-700 hover:border-slate-600"
              }`}
            >
              {endPreview ? (
                <div className="aspect-video w-full">
                  <img src={endPreview} alt="End frame" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-slate-500">
                  {uploadingEnd ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
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
            <input ref={endFileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], setEndImageUrl, setEndPreview, setUploadingEnd)} />
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
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Video Config */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Modelo</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              {VIDEO_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Duração</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value={5}>5 segundos</option>
              <option value={10}>10 segundos</option>
              <option value={15}>15 segundos</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Preset Câmera</label>
            <select value={preset} onChange={(e) => setPreset(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="">Nenhum</option>
              {CAMERA_PRESETS.filter(Boolean).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !startImageUrl || !movementPrompt.trim()}
          className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Enviando vídeo...
            </span>
          ) : "Enviar Vídeo"}
        </button>

        {/* Result */}
        {result && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-white">Vídeo Enviado</h3>
            <p className="text-xs text-slate-400">
              Request ID: <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-emerald-400">{result.request_id}</code>
            </p>
            <p className="text-xs text-slate-500">
              Acompanhe o status na seção Batch ou aguarde o resultado aparecer na Galeria.
            </p>
            {result.video_url && <VideoPlayer url={result.video_url} />}
          </div>
        )}
      </div>
    </div>
  );
}

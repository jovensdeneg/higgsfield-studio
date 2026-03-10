"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CharacterSelector from "@/components/CharacterSelector";
import FrameSection from "@/components/FrameSection";
import { parseBatchText, type ParseResult } from "@/lib/batch-text-parser";

type GenerateMode = "standard" | "batch";

// ---------------------------------------------------------------------------
// Batch progress state
// ---------------------------------------------------------------------------

interface BatchSceneResult {
  scene_id: string;
  start_prompt: string;
  end_prompt: string | null;
}

// ---------------------------------------------------------------------------
// Image models per provider
// ---------------------------------------------------------------------------

const HF_IMAGE_MODELS = [
  { value: "nano-banana-pro", label: "Nano Banana Pro" },
  { value: "flux-pro-kontext-max", label: "Flux Pro Kontext Max" },
  { value: "seedream-v4", label: "Seedream v4" },
];

const GOOGLE_IMAGE_MODELS = [
  { value: "nano-banana-pro", label: "Nano Banana Pro" },
  { value: "nano-banana-2", label: "Nano Banana 2 (Fast)" },
  { value: "nano-banana", label: "Nano Banana" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GeneratePage() {
  const router = useRouter();

  // Provider
  const [provider, setProvider] = useState<"higgsfield" | "google">("google");

  // Derived model list
  const imageModels = provider === "google" ? GOOGLE_IMAGE_MODELS : HF_IMAGE_MODELS;

  // Tab mode
  const [mode, setMode] = useState<GenerateMode>("standard");

  // ── Standard mode state ──
  const [characterId, setCharacterId] = useState<string | null>(null);

  // Start frame (required)
  const [startPrompt, setStartPrompt] = useState("");
  const [startModel, setStartModel] = useState("nano-banana-pro");
  const [startVariations, setStartVariations] = useState(3);
  const [startRefs, setStartRefs] = useState<string[]>([]);

  // End frame (optional)
  const [showEndFrame, setShowEndFrame] = useState(false);
  const [endPrompt, setEndPrompt] = useState("");
  const [endModel, setEndModel] = useState("nano-banana-pro");
  const [endVariations, setEndVariations] = useState(3);
  const [endRefs, setEndRefs] = useState<string[]>([]);

  // ── Batch mode state ──
  const [batchCharacterId, setBatchCharacterId] = useState<string | null>(null);
  const [batchModel, setBatchModel] = useState("nano-banana-pro");
  const [batchText, setBatchText] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchCurrentScene, setBatchCurrentScene] = useState(0);
  const [batchTotalScenes, setBatchTotalScenes] = useState(0);
  const [batchMessage, setBatchMessage] = useState("");
  const [batchResults, setBatchResults] = useState<BatchSceneResult[]>([]);

  // ── Shared state ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Elapsed time counter ──
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAnyLoading = loading || batchLoading;

  useEffect(() => {
    if (isAnyLoading) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAnyLoading]);

  function formatElapsed(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
  }

  // ── Reset models when provider changes ──
  useEffect(() => {
    setStartModel("nano-banana-pro");
    setEndModel("nano-banana-pro");
    setBatchModel("nano-banana-pro");
  }, [provider]);

  // ── Reference image info for Google provider ──
  const referenceImageWarning =
    provider === "google"
      ? "Nano Banana aceita referências visuais para manter fidelidade ao personagem."
      : null;

  // ── Batch text parsing (live preview) ──
  const parsePreview: ParseResult = useMemo(
    () => parseBatchText(batchText),
    [batchText]
  );

  // ── Standard mode handlers ──

  function handleRemoveEndFrame() {
    setShowEndFrame(false);
    setEndPrompt("");
    setEndModel("nano-banana-pro");
    setEndVariations(3);
    setEndRefs([]);
  }

  async function handleStandardSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!startPrompt.trim()) {
      setError("O prompt do frame inicial é obrigatório.");
      return;
    }

    setLoading(true);
    setError(null);

    const includeEndFrame = showEndFrame && endPrompt.trim();

    const body: Record<string, unknown> = {
      prompt: startPrompt.trim(),
      model: startModel,
      num_variations: startVariations,
      reference_images: startRefs,
      character_id: characterId,
      provider: provider,
    };

    if (includeEndFrame) {
      body.end_frame_prompt = endPrompt.trim();
      body.end_frame_model = endModel;
      body.end_frame_num_variations = endVariations;
      body.end_frame_reference_images = endRefs;
    }

    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao gerar cena");
      }

      router.push(`/scenes/${data.scene.scene_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  // ── Batch mode handlers ──

  async function handleBatchSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!batchText.trim()) {
      setError("Cole o texto com as descrições das imagens.");
      return;
    }

    const parsed = parseBatchText(batchText);

    if (parsed.scenes.length === 0) {
      setError(
        parsed.errors.join(". ") ||
          "Nenhuma imagem encontrada. Use o formato ##image1 seguido da descrição."
      );
      return;
    }

    setBatchLoading(true);
    setBatchResults([]);
    setBatchCurrentScene(0);
    setBatchTotalScenes(parsed.scenes.length);
    setBatchMessage("");
    setError(null);

    const results: BatchSceneResult[] = [];

    try {
      for (let i = 0; i < parsed.scenes.length; i++) {
        const scene = parsed.scenes[i];
        setBatchCurrentScene(i + 1);
        setBatchMessage(
          `Gerando cena ${i + 1} de ${parsed.scenes.length}...`
        );

        const body: Record<string, unknown> = {
          prompt: scene.startFrame.prompt,
          model: batchModel,
          num_variations: 2,
          character_id: batchCharacterId,
          provider: provider,
        };

        if (scene.endFrame) {
          body.end_frame_prompt = scene.endFrame.prompt;
          body.end_frame_model = batchModel;
          body.end_frame_num_variations = 2;
        }

        if (scene.movementPrompt) {
          body.movement_prompt = scene.movementPrompt;
        }

        const res = await fetch("/api/scenes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            `Erro na cena ${i + 1}: ${data.error || "Falha na geração"}`
          );
        }

        results.push({
          scene_id: data.scene.scene_id,
          start_prompt: scene.startFrame.prompt.slice(0, 80),
          end_prompt: scene.endFrame
            ? scene.endFrame.prompt.slice(0, 80)
            : null,
        });

        // Update results as they come in
        setBatchResults([...results]);
      }

      setBatchMessage(
        `${results.length} cena${results.length > 1 ? "s" : ""} criada${results.length > 1 ? "s" : ""} com sucesso!`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      if (results.length > 0) {
        setBatchMessage(
          `${results.length} cena${results.length > 1 ? "s" : ""} criada${results.length > 1 ? "s" : ""} antes do erro.`
        );
      }
    } finally {
      setBatchLoading(false);
    }
  }

  // ── Render ──

  const batchPercent =
    batchTotalScenes > 0
      ? Math.round((batchCurrentScene / batchTotalScenes) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Nova Cena</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure os frames da cena e gere variações de imagem como keyframes.
        </p>
      </div>

      {/* Provider selector */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <label className="mb-2 block text-xs font-medium text-slate-400 uppercase tracking-wide">Provedor</label>
        <div className="flex gap-1 rounded-lg bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setProvider("google")}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
              provider === "google"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Google (Nano Banana + Veo)
          </button>
          <button
            type="button"
            onClick={() => setProvider("higgsfield")}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
              provider === "higgsfield"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Higgsfield
          </button>
        </div>
        {provider === "google" && (
          <p className="mt-2 text-xs text-emerald-400/70">Usando GOOGLE_AI_KEY + Vercel Blob</p>
        )}
        {provider === "higgsfield" && (
          <p className="mt-2 text-xs text-slate-500">Requer HF_API_KEY + HF_API_SECRET com créditos ativos</p>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 rounded-lg bg-slate-900 p-1">
        <button
          type="button"
          onClick={() => { setMode("standard"); setError(null); }}
          className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === "standard"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Padrão
        </button>
        <button
          type="button"
          onClick={() => { setMode("batch"); setError(null); }}
          className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === "batch"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Texto em Lote
        </button>
      </div>

      {/* ================================================================== */}
      {/* STANDARD MODE                                                      */}
      {/* ================================================================== */}
      {mode === "standard" && (
        <form onSubmit={handleStandardSubmit} className="space-y-6">
          {/* Character (optional) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <CharacterSelector
              selectedId={characterId}
              onSelect={setCharacterId}
              disabled={loading}
            />
            {provider === "google" && (
              <p className="mt-1 text-xs text-emerald-400/70">Nano Banana aceita referências visuais para manter fidelidade ao personagem.</p>
            )}
          </div>

          {/* Start Frame (required) */}
          <FrameSection
            title="Frame Inicial"
            prompt={startPrompt}
            onPromptChange={setStartPrompt}
            model={startModel}
            onModelChange={setStartModel}
            numVariations={startVariations}
            onNumVariationsChange={setStartVariations}
            referenceImages={startRefs}
            onReferenceImagesChange={setStartRefs}
            disabled={loading}
            imageModels={imageModels}
            referenceImageWarning={referenceImageWarning}
          />

          {/* End Frame (optional, collapsible) */}
          {!showEndFrame ? (
            <button
              type="button"
              onClick={() => setShowEndFrame(true)}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 px-4 py-4 text-sm text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
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
              Adicionar Frame Final
            </button>
          ) : (
            <div className="space-y-3">
              <FrameSection
                title="Frame Final"
                prompt={endPrompt}
                onPromptChange={setEndPrompt}
                model={endModel}
                onModelChange={setEndModel}
                numVariations={endVariations}
                onNumVariationsChange={setEndVariations}
                referenceImages={endRefs}
                onReferenceImagesChange={setEndRefs}
                disabled={loading}
                imageModels={imageModels}
                referenceImageWarning={referenceImageWarning}
              />
              <button
                type="button"
                onClick={handleRemoveEndFrame}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Remover Frame Final
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !startPrompt.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Gerando imagens...
              </>
            ) : (
              "Gerar Imagens"
            )}
          </button>

          {loading && (
            <div className="rounded-xl border border-blue-700/50 bg-blue-900/20 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-400">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400" />
                  Gerando imagens...
                </h3>
                <span className="font-mono text-lg font-bold text-blue-400">
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-full animate-[loading_2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600 bg-[length:200%_100%]" />
              </div>
              <p className="text-xs text-blue-300/70">
                Cada variacao pode demorar de 30 segundos a 2 minutos. Nao feche esta pagina.
              </p>
            </div>
          )}
        </form>
      )}

      {/* ================================================================== */}
      {/* BATCH TEXT MODE                                                     */}
      {/* ================================================================== */}
      {mode === "batch" && (
        <form onSubmit={handleBatchSubmit} className="space-y-6">
          {/* Character (optional) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <CharacterSelector
              selectedId={batchCharacterId}
              onSelect={setBatchCharacterId}
              disabled={batchLoading}
            />
            {provider === "google" && (
              <p className="mt-1 text-xs text-emerald-400/70">Nano Banana aceita referências visuais para manter fidelidade ao personagem.</p>
            )}
          </div>

          {/* Model selector */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Modelo de Imagem
            </label>
            <select
              value={batchModel}
              onChange={(e) => setBatchModel(e.target.value)}
              disabled={batchLoading}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
            >
              {imageModels.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Todas as imagens do lote serão geradas com este modelo. 2 variações por imagem.
            </p>
          </div>

          {/* Batch text input */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <label className="block text-sm font-medium text-slate-300">
              Descrições das Imagens
            </label>
            <textarea
              rows={16}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              disabled={batchLoading}
              placeholder={`##image1\nPhotorealistic 4K, 16:9. A young Brazilian entrepreneur standing in a modern coworking space, golden hour light...\n\n##image2\nSame young entrepreneur now sitting at a minimalist desk, laptop open, warm ambient lighting...\n\n##scene1\nThe entrepreneur walks from the coworking space window to his desk, sits down and opens his laptop with determination...\n\n##image3\nAerial drone view of a bustling Brazilian city at sunset, skyscrapers reflecting warm orange light...\n\n##image4\nStreet-level view of the same city at night, neon signs glowing in Portuguese, motion blur...\n\n##scene2\nSmooth aerial descent from the city skyline transitioning to street level as day turns to night...`}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
            />

            <p className="text-xs text-slate-500">
              Use <code className="rounded bg-slate-800 px-1.5 py-0.5 text-emerald-400">##image1</code>,{" "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-emerald-400">##image2</code> para frames e{" "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-blue-400">##scene1</code> para o prompt do vídeo.
              Imagens ímpares = frame inicial, pares = frame final. O end frame usa o start como referência visual.
            </p>
          </div>

          {/* Live parsing preview */}
          {batchText.trim() && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
                  <svg
                    className="h-4 w-4 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {parsePreview.images.length} imagem{parsePreview.images.length !== 1 ? "ns" : ""} detectada{parsePreview.images.length !== 1 ? "s" : ""}
                    {" → "}
                    {parsePreview.scenes.length} cena{parsePreview.scenes.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    {parsePreview.images.length * 2} imagens serão geradas no total (2 variações cada)
                  </p>
                </div>
              </div>

              {/* Scene list */}
              {parsePreview.scenes.length > 0 && (
                <div className="space-y-2 pl-11">
                  {parsePreview.scenes.map((scene) => (
                    <div
                      key={scene.sceneIndex}
                      className="flex items-start gap-2 text-xs"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-800 text-[10px] font-bold text-emerald-400">
                        {scene.sceneIndex + 1}
                      </span>
                      <div className="text-slate-400">
                        <span className="text-slate-300">Start:</span>{" "}
                        {scene.startFrame.prompt.slice(0, 60)}
                        {scene.startFrame.prompt.length > 60 ? "..." : ""}
                        {scene.endFrame ? (
                          <>
                            <br />
                            <span className="text-slate-300">End:</span>{" "}
                            {scene.endFrame.prompt.slice(0, 60)}
                            {scene.endFrame.prompt.length > 60 ? "..." : ""}
                          </>
                        ) : (
                          <>
                            <br />
                            <span className="italic text-slate-500">
                              Sem frame final
                            </span>
                          </>
                        )}
                        {scene.movementPrompt ? (
                          <>
                            <br />
                            <span className="text-blue-400">Video:</span>{" "}
                            {scene.movementPrompt.slice(0, 60)}
                            {scene.movementPrompt.length > 60 ? "..." : ""}
                          </>
                        ) : (
                          <>
                            <br />
                            <span className="italic text-slate-600">
                              Sem prompt de vídeo (##scene{scene.sceneIndex + 1})
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {parsePreview.errors.length > 0 && (
                <div className="space-y-1 pl-11">
                  {parsePreview.errors.map((err, i) => (
                    <p key={i} className="text-xs text-amber-400">
                      ⚠ {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Progress */}
          {batchLoading && (
            <div className="rounded-xl border border-blue-700/50 bg-blue-900/20 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-400">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400" />
                  Gerando em Lote...
                </h3>
                <div className="text-right">
                  <span className="text-2xl font-bold text-emerald-400">
                    {batchPercent}%
                  </span>
                  <p className="font-mono text-xs text-blue-400">
                    {formatElapsed(elapsedSeconds)}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700 ease-out"
                  style={{ width: `${Math.max(batchPercent, 3)}%` }}
                />
              </div>

              <p className="text-sm text-white font-medium">{batchMessage}</p>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Cena {batchCurrentScene} de {batchTotalScenes} | 2 variacoes por imagem
                </span>
                <span>Nao feche esta pagina</span>
              </div>

              <p className="text-xs text-blue-300/60">
                Cada cena pode demorar de 1 a 3 minutos (geracao + polling da API).
              </p>
            </div>
          )}

          {/* Results */}
          {batchResults.length > 0 && !batchLoading && (
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-900/20 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-emerald-400">
                {batchMessage}
              </h3>

              <div className="space-y-2">
                {batchResults.map((r) => (
                  <Link
                    key={r.scene_id}
                    href={`/scenes/${r.scene_id}`}
                    className="block rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 transition-colors hover:border-emerald-700 hover:bg-slate-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">
                        {r.scene_id}
                      </span>
                      <svg
                        className="h-4 w-4 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </div>
                    <p className="mt-1 text-xs text-slate-400 truncate">
                      Start: {r.start_prompt}
                      {r.start_prompt.length >= 80 ? "..." : ""}
                    </p>
                    {r.end_prompt && (
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        End: {r.end_prompt}
                        {r.end_prompt.length >= 80 ? "..." : ""}
                      </p>
                    )}
                  </Link>
                ))}
              </div>

              <Link
                href="/scenes"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
              >
                Ver Todas as Cenas
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
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Link>
            </div>
          )}

          {/* Submit button */}
          {!batchResults.length && (
            <button
              type="submit"
              disabled={batchLoading || parsePreview.scenes.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {batchLoading ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Gerando {batchCurrentScene}/{batchTotalScenes}...
                </>
              ) : parsePreview.scenes.length > 0 ? (
                `Gerar ${parsePreview.scenes.length} Cena${parsePreview.scenes.length > 1 ? "s" : ""} em Lote`
              ) : (
                "Adicione descrições com ##image1, ##image2..."
              )}
            </button>
          )}

          {/* Reset button after results */}
          {batchResults.length > 0 && !batchLoading && (
            <button
              type="button"
              onClick={() => {
                setBatchText("");
                setBatchResults([]);
                setBatchMessage("");
                setError(null);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
            >
              Gerar Novo Lote
            </button>
          )}
        </form>
      )}
    </div>
  );
}

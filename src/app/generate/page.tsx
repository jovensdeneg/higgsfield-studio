"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CharacterSelector from "@/components/CharacterSelector";
import FrameSection from "@/components/FrameSection";

export default function GeneratePage() {
  const router = useRouter();

  // Character
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

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRemoveEndFrame() {
    setShowEndFrame(false);
    setEndPrompt("");
    setEndModel("nano-banana-pro");
    setEndVariations(3);
    setEndRefs([]);
  }

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Nova Cena</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure os frames da cena e gere variações de imagem como keyframes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Character (optional) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <CharacterSelector
            selectedId={characterId}
            onSelect={setCharacterId}
            disabled={loading}
          />
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
          <p className="text-center text-xs text-slate-500">
            Isso pode levar alguns minutos. Cada variação é gerada separadamente.
          </p>
        )}
      </form>
    </div>
  );
}

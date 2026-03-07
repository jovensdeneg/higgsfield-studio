"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const IMAGE_MODELS = [
  { value: "nano-banana-pro", label: "Nano Banana Pro (padrao)" },
  { value: "flux-pro-kontext-max", label: "Flux Pro Kontext Max" },
  { value: "seedream-v4", label: "Seedream v4" },
];

export default function GeneratePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("nano-banana-pro");
  const [numVariations, setNumVariations] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          num_variations: numVariations,
        }),
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
      <div>
        <h1 className="text-2xl font-bold text-white">Nova Cena</h1>
        <p className="mt-1 text-sm text-slate-400">
          Descreva a cena e gere variacoes de imagem como keyframes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-slate-300">
            Prompt da Cena
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="Descreva a cena em detalhes. Ex: Uma mulher caminhando por uma floresta encantada ao entardecer, com raios de luz dourada passando entre as arvores..."
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="model" className="block text-sm font-medium text-slate-300">
            Modelo de Imagem
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            disabled={loading}
          >
            {IMAGE_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            Numero de Variacoes
          </label>
          <div className="mt-2 flex items-center gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumVariations(n)}
                disabled={loading}
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                  numVariations === n
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Gerando imagens...
            </span>
          ) : (
            "Gerar Imagens"
          )}
        </button>

        {loading && (
          <p className="text-center text-xs text-slate-500">
            Isso pode levar alguns minutos. Cada variacao e gerada separadamente.
          </p>
        )}
      </form>
    </div>
  );
}

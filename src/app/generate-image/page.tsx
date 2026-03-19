"use client";

import { useState } from "react";
import ImprovePromptButton from "@/components/ImprovePromptButton";

const PROVIDERS = [
  {
    value: "higgsfield",
    label: "Higgsfield",
    models: [
      { value: "nano-banana-pro", label: "Nano Banana Pro" },
      { value: "flux-pro-kontext-max", label: "Flux Pro Kontext Max" },
      { value: "seedream-v4", label: "Seedream V4" },
    ],
  },
  {
    value: "google",
    label: "Google AI",
    models: [
      { value: "nano-banana-pro", label: "Nano Banana Pro" },
    ],
  },
  {
    value: "runway",
    label: "Runway",
    models: [
      { value: "gen4_image_turbo", label: "Gen4 Image Turbo" },
    ],
  },
];

interface GeneratedImage {
  url: string;
  prompt: string;
  provider: string;
  model: string;
  timestamp: string;
}

export default function GenerateImagePage() {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState("higgsfield");
  const [model, setModel] = useState("nano-banana-pro");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GeneratedImage[]>([]);

  const currentProvider = PROVIDERS.find((p) => p.value === provider);
  const models = currentProvider?.models ?? [];

  function handleProviderChange(newProvider: string) {
    setProvider(newProvider);
    const prov = PROVIDERS.find((p) => p.value === newProvider);
    if (prov && prov.models.length > 0) {
      setModel(prov.models[0].value);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          provider,
          model,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Erro ${res.status}`);
      } else if (data.url) {
        setResults((prev) => [
          {
            url: data.url,
            prompt: prompt.trim(),
            provider,
            model,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        setError("Nenhuma imagem retornada.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de rede");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Imagem Direta</h1>
        <p className="mt-1 text-sm text-slate-400">
          Gere uma imagem a partir de um prompt, selecionando o provider e modelo
        </p>
      </div>

      <div className="space-y-6">
        {/* Provider Toggle */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Provider</label>
          <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => handleProviderChange(p.value)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  provider === p.value
                    ? "bg-purple-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Modelo</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-400">Prompt *</label>
            <ImprovePromptButton prompt={prompt} context="image" onImproved={setPrompt} />
          </div>
          <textarea
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Descreva a imagem que deseja gerar..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || generating}
          className="w-full rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Gerando imagem...
            </span>
          ) : (
            "Gerar Imagem"
          )}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Imagens Geradas</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map((img, i) => (
              <div
                key={`${img.timestamp}-${i}`}
                className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-slate-800">
                  <img
                    src={img.url}
                    alt={img.prompt}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Download */}
                  <a
                    href={img.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-purple-600 group-hover:opacity-100"
                    title="Baixar"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </a>
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-xs text-slate-400">{img.prompt}</p>
                  <p className="mt-1 text-[10px] text-purple-400/60">
                    {img.provider} · {img.model}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

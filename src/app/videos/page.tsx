"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";

interface GalleryItem {
  id: string;
  source: "project" | "scene";
  source_id: string;
  source_name: string;
  asset_code?: string;
  scene?: string;
  description: string;
  image_url: string | null;
  video_url: string | null;
  image_tool?: string;
  video_tool?: string;
  created_at: string;
}

type Tab = "all" | "images" | "videos";

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    async function fetchGallery() {
      try {
        setLoading(true);
        const res = await fetch("/api/gallery?type=all");
        if (!res.ok) throw new Error("Erro ao carregar galeria");
        const data = await res.json();
        setItems(data.items ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar galeria"
        );
      } finally {
        setLoading(false);
      }
    }
    fetchGallery();
  }, []);

  const filtered = items.filter((item) => {
    if (tab === "images") return item.image_url && !item.video_url;
    if (tab === "videos") return item.video_url;
    return true;
  });

  const imageCount = items.filter((i) => i.image_url && !i.video_url).length;
  const videoCount = items.filter((i) => i.video_url).length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
          <p className="text-sm text-slate-400">Carregando galeria...</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Galeria</h1>
        <p className="mt-1 text-sm text-slate-400">
          Imagens e videos gerados nos seus projetos
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(
          [
            { key: "all", label: "Tudo", count: items.length },
            { key: "images", label: "Imagens", count: imageCount },
            { key: "videos", label: "Videos", count: videoCount },
          ] as { key: Tab; label: string; count: number }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {t.label}
            <span className="ml-1.5 opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum item disponivel"
          description="Imagens e videos aparecerao aqui quando forem gerados e aprovados nos seus projetos."
          actionLabel="Ir para Projetos"
          actionHref="/projects"
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition-all hover:border-slate-700"
            >
              {/* Media */}
              <div className="relative aspect-video w-full overflow-hidden bg-slate-800">
                {item.video_url ? (
                  <video
                    src={item.video_url}
                    poster={item.image_url ?? undefined}
                    controls
                    className="h-full w-full object-cover"
                  />
                ) : item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.description}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <svg
                      className="h-8 w-8 text-slate-700"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                      />
                    </svg>
                  </div>
                )}
                {/* Type badge */}
                <div className="absolute left-2 top-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                      item.video_url
                        ? "bg-blue-500/15 text-blue-400 ring-blue-500/30"
                        : "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
                    }`}
                  >
                    {item.video_url ? "Video" : "Imagem"}
                  </span>
                </div>
                {/* Download button */}
                <div className="absolute bottom-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <a
                    href={item.video_url ?? item.image_url ?? "#"}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-white backdrop-blur transition-colors hover:bg-emerald-600"
                    title="Baixar"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </a>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                {item.asset_code && (
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {item.asset_code}
                    </span>
                    {item.scene && (
                      <span className="text-[11px] font-medium text-emerald-400/80">
                        {item.scene}
                      </span>
                    )}
                  </div>
                )}
                <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
                  {item.description}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    {item.image_tool && <span>{item.image_tool}</span>}
                    {item.video_tool && (
                      <>
                        <span className="text-slate-700">|</span>
                        <span>{item.video_tool}</span>
                      </>
                    )}
                  </div>
                  {item.source === "project" && (
                    <Link
                      href={`/projects/${item.source_id}`}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline"
                    >
                      {item.source_name}
                    </Link>
                  )}
                  {item.source === "scene" && (
                    <Link
                      href={`/scenes/${item.source_id}`}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline"
                    >
                      {item.source_name}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

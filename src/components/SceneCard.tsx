"use client";

import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";

interface Scene {
  scene_id: string;
  status: string;
  original_prompt: string;
  generated_images: string[];
  video_url?: string | null;
  approved_image_index?: number | null;
}

interface SceneCardProps {
  scene: Scene;
}

export default function SceneCard({ scene }: SceneCardProps) {
  const {
    scene_id,
    status,
    original_prompt,
    generated_images,
    approved_image_index,
  } = scene;

  const truncatedPrompt =
    original_prompt.length > 80
      ? original_prompt.slice(0, 80) + "..."
      : original_prompt;

  // Pick the best thumbnail: approved image first, then the first available image
  const thumbnailUrl =
    approved_image_index != null && generated_images[approved_image_index]
      ? generated_images[approved_image_index]
      : generated_images[0] ?? null;

  return (
    <Link
      href={`/scenes/${scene_id}`}
      className="group block rounded-xl border border-slate-800 bg-slate-900 transition-all hover:border-slate-700 hover:shadow-lg hover:shadow-slate-950/50"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-slate-800">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`Cena ${scene_id}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              className="h-10 w-10 text-slate-600"
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
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-white">
            {scene_id}
          </h3>
          <StatusBadge status={status} />
        </div>

        <p className="text-sm leading-relaxed text-slate-400">
          {truncatedPrompt}
        </p>
      </div>
    </Link>
  );
}

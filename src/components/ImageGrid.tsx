"use client";

import { useState } from "react";

interface ImageItem {
  url: string;
  metadata?: Record<string, unknown>;
}

interface ImageGridProps {
  images: ImageItem[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

function ImagePlaceholder() {
  return (
    <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-slate-800">
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
  );
}

export default function ImageGrid({
  images,
  selectedIndex,
  onSelect,
}: ImageGridProps) {
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set());

  const handleImageError = (index: number) => {
    setBrokenImages((prev) => new Set(prev).add(index));
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((image, index) => {
        const isSelected = selectedIndex === index;
        const isBroken = brokenImages.has(index);
        const hasUrl = image.url && image.url.trim() !== "";

        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            className={`group relative overflow-hidden rounded-xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
              isSelected
                ? "border-purple-500 shadow-lg shadow-purple-500/20"
                : "border-slate-700 hover:border-slate-600"
            }`}
          >
            {/* Image or Placeholder */}
            {hasUrl && !isBroken ? (
              <img
                src={image.url}
                alt={`Varia\u00e7\u00e3o ${index + 1}`}
                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={() => handleImageError(index)}
              />
            ) : (
              <ImagePlaceholder />
            )}

            {/* Selected overlay checkmark */}
            {isSelected && (
              <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500">
                <svg
                  className="h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              </div>
            )}

            {/* Label */}
            <div className="bg-slate-900/80 px-3 py-2 text-center text-sm font-medium text-slate-300 backdrop-blur-sm">
              Varia\u00e7\u00e3o {index + 1}
            </div>
          </button>
        );
      })}
    </div>
  );
}

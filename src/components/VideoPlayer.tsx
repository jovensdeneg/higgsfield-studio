"use client";

interface VideoPlayerProps {
  url?: string;
  title?: string;
}

export default function VideoPlayer({ url, title }: VideoPlayerProps) {
  if (!url) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <svg
            className="h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V7.5a2.25 2.25 0 0 1 2.25-2.25h12.75a.75.75 0 0 1 .75.75"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3l18 18"
            />
          </svg>
          <p className="text-sm font-medium">
            V&iacute;deo ainda n&atilde;o dispon&iacute;vel
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      {title && (
        <div className="border-b border-slate-800 px-4 py-2.5">
          <h3 className="text-sm font-medium text-slate-300">{title}</h3>
        </div>
      )}
      <video
        src={url}
        controls
        className="aspect-video w-full bg-black"
        preload="metadata"
      >
        Seu navegador n&atilde;o suporta a tag de v&iacute;deo.
      </video>
    </div>
  );
}

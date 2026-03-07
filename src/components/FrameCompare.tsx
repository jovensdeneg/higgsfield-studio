"use client";

interface FrameCompareProps {
  startImageUrl: string;
  endImageUrl?: string | null;
}

export default function FrameCompare({ startImageUrl, endImageUrl }: FrameCompareProps) {
  return (
    <div className={`grid gap-4 ${endImageUrl ? "grid-cols-2" : "grid-cols-1 max-w-md"}`}>
      <div className="overflow-hidden rounded-xl border border-slate-800">
        <div className="bg-slate-900 px-3 py-2 text-center text-xs font-medium text-slate-400">
          Frame Inicial
        </div>
        <div className="aspect-video">
          <img src={startImageUrl} alt="Frame Inicial" className="h-full w-full object-cover" />
        </div>
      </div>
      {endImageUrl && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <div className="bg-slate-900 px-3 py-2 text-center text-xs font-medium text-slate-400">
            Frame Final
          </div>
          <div className="aspect-video">
            <img src={endImageUrl} alt="Frame Final" className="h-full w-full object-cover" />
          </div>
        </div>
      )}
    </div>
  );
}

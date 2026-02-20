"use client";

import clsx from "clsx";

export type ShareKind = "text" | "files";

export default function ShareSwitch({
  value,
  onChange
}: {
  value: ShareKind;
  onChange: (next: ShareKind) => void;
}) {
  const indicatorStyle = {
    width: value === "text" ? 96 : 88,
    transform: value === "text" ? "translateX(0px)" : "translateX(96px)"
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.35em] text-ink-200/70">Share</span>
      <div className="relative inline-flex rounded-2xl border border-ink-700 bg-ink-900/60 p-1 text-sm">
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 rounded-xl bg-tide-500 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={indicatorStyle}
        />
        <button
          type="button"
          onClick={() => onChange("text")}
          className={clsx(
            "relative z-10 rounded-xl px-4 py-2 font-semibold transition-colors duration-300",
            value === "text" ? "text-ink-900" : "text-ink-200 hover:text-ink-100",
            "w-[96px] text-center"
          )}
        >
          Text
        </button>
        <button
          type="button"
          onClick={() => onChange("files")}
          className={clsx(
            "relative z-10 rounded-xl px-4 py-2 font-semibold transition-colors duration-300",
            value === "files" ? "text-ink-900" : "text-ink-200 hover:text-ink-100",
            "w-[88px] text-center"
          )}
        >
          Files
        </button>
      </div>
    </div>
  );
}

"use client";

import clsx from "clsx";

export type ShareKind = "text" | "files";

const tabs: { kind: ShareKind; label: string; description: string; icon: React.ReactNode }[] = [
  {
    kind: "text",
    label: "Message",
    description: "Send text or code",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    )
  },
  {
    kind: "files",
    label: "File",
    description: "Upload any file",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    )
  }
];

export default function ShareSwitch({
  value,
  onChange
}: {
  value: ShareKind;
  onChange: (next: ShareKind) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Share type">
      {tabs.map((tab) => {
        const active = value === tab.kind;
        return (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.kind)}
            className={clsx(
              "flex items-center gap-3 rounded-2xl border px-5 py-3.5 text-left transition-all duration-200",
              active
                ? "border-tide-500/60 bg-tide-500/10 text-tide-200"
                : "border-ink-700 bg-ink-900/40 text-ink-200 hover:border-ink-600 hover:text-ink-100"
            )}
          >
            <span className={clsx("shrink-0 transition-colors", active ? "text-tide-400" : "text-ink-400")}>
              {tab.icon}
            </span>
            <span>
              <span className="block text-sm font-semibold leading-tight">{tab.label}</span>
              <span className="block text-xs text-ink-400 leading-tight mt-0.5">{tab.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

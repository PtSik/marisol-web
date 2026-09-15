"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

export type VoiceLine = { source: "user" | "ai"; text: string };

/** The landing demo runs on a photographic backdrop, so its stage is cream on dark. The onboarding
 *  preview sits inside the wizard card with no backdrop and inverts. */
export type VoiceTone = "dark" | "light";

const TONE = {
  dark: {
    pill: "bg-ink/30 text-cream backdrop-blur-md",
    ringOuter: "border-white/70",
    ringInner: "border-white/50",
    orb: "bg-cream/90 shadow-[inset_0_0_24px_rgba(255,255,255,0.6),0_12px_30px_-10px_rgba(36,27,20,0.5)]",
    mic: "text-ink",
    bar: "bg-cream/95",
    timer: "text-ink",
    footnote: "text-ink/[0.62]",
  },
  light: {
    pill: "bg-ink/[0.07] text-ink",
    ringOuter: "border-ink/25",
    ringInner: "border-ink/15",
    orb: "bg-offwhite shadow-[inset_0_0_24px_rgba(255,255,255,0.9),0_12px_30px_-14px_rgba(36,27,20,0.35)]",
    mic: "text-ink",
    bar: "bg-ink/70",
    timer: "text-ink",
    footnote: "text-muted-2",
  },
} as const;

export function StatusPill({
  tone,
  dot,
  children,
}: { tone: VoiceTone; dot: string; children: ReactNode }) {
  return (
    <div
      className={`flex items-center gap-[7px] rounded-full px-3 py-1.5 t-caption md:py-[7px] ${TONE[tone].pill}`}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: dot, boxShadow: `0 0 0 4px ${dot}33` }}
      />
      {children}
    </div>
  );
}

/** The orb, its rings, the level bars and the clock — the part that says a call is happening. */
export function VoiceOrb({
  tone,
  active,
  busy,
  isSpeaking,
  timer,
  compact,
}: {
  tone: VoiceTone;
  active: boolean;
  busy: boolean;
  isSpeaking: boolean;
  timer: string;
  /** The wizard shows this inside a form card, where the landing's 128px orb dominates the step. */
  compact?: boolean;
}) {
  const c = TONE[tone];
  const orbScale = active && isSpeaking ? 1.12 : active ? 1.04 : 1;
  const ringAnim = busy ? "ringOut 2.4s ease-out infinite" : "none";
  const waveOpacity = active && !isSpeaking ? 1 : active ? 0.4 : 0.18;
  const waveAnim = busy ? "bar 0.7s ease-in-out infinite" : "none";
  const size = compact ? "h-14 w-14 md:h-[68px] md:w-[68px]" : "h-20 w-20 md:h-32 md:w-32";
  const inner = compact ? "h-10 w-10 md:h-12 md:w-12" : "h-14 w-14 md:h-24 md:w-24";

  return (
    <>
      <div className={`relative flex items-center justify-center ${size}`}>
        <div
          className={`absolute h-full w-full rounded-full border-[1.5px] ${c.ringOuter}`}
          style={{ animation: ringAnim }}
        />
        <div
          className={`absolute h-full w-full rounded-full border-[1.5px] ${c.ringInner}`}
          style={{ animation: busy ? "ringOut 2.4s ease-out infinite 1.2s" : "none" }}
        />
        <div
          className={`flex items-center justify-center rounded-full transition-transform duration-300 ${inner} ${c.orb}`}
          style={{
            transform: `scale(${orbScale})`,
            animation: active && isSpeaking ? "orbBreathe 1.4s ease-in-out infinite" : "none",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`${compact ? "h-4 w-4 md:h-5 md:w-5" : "h-5 w-5 md:h-[34px] md:w-[34px]"} ${c.mic}`}
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
          </svg>
        </div>
      </div>
      <div
        aria-hidden="true"
        className={`flex items-center gap-[5px] transition-opacity duration-300 ${
          compact ? "h-4" : "h-5 md:h-[30px]"
        }`}
        style={{ opacity: waveOpacity }}
      >
        {[0, 120, 240, 360, 180, 300, 60].map((delay) => (
          <span
            key={delay}
            className={`h-full w-1 origin-center rounded-[3px] ${c.bar}`}
            style={{ animation: waveAnim, animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      <div
        className={`font-display tabular-nums tracking-[-0.02em] ${c.timer} ${
          compact ? "t-body" : "text-xl md:text-[30px]"
        }`}
      >
        {timer}
      </div>
    </>
  );
}

export function VoiceFootnote({
  tone,
  className = "",
  children,
}: { tone: VoiceTone; className?: string; children: ReactNode }) {
  return (
    <div className={`max-w-[34ch] text-center t-caption ${TONE[tone].footnote} ${className}`}>
      {children}
    </div>
  );
}

/** Scrolls itself to the newest line, so a call that outruns the box does not strand the reader. */
export function VoiceTranscript({
  lines,
  speakerAi,
  speakerUser,
  className = "",
  children,
}: {
  lines: readonly VoiceLine[];
  speakerAi: string;
  speakerUser: string;
  className?: string;
  /** Shown while nothing has been said yet. */
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll must re-run when lines change
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  return (
    <div
      ref={ref}
      aria-live="polite"
      className={`flex min-h-0 flex-1 flex-col gap-[10px] overflow-y-auto px-1 py-2 ${className}`}
    >
      {lines.length === 0
        ? children
        : lines.map((line, i) => {
            const ai = line.source === "ai";
            return (
              <div
                key={`${i}-${line.text.slice(0, 8)}`}
                className={`flex ${ai ? "justify-start" : "justify-end"}`}
              >
                <div className="flex max-w-[82%] flex-col gap-[3px]">
                  <span className={`px-1 t-eyebrow ${ai ? "text-muted-3" : "text-muted-4"}`}>
                    {ai ? speakerAi : speakerUser}
                  </span>
                  <div
                    className={`px-[15px] py-[11px] t-body-sm ${
                      ai
                        ? "rounded-[16px_16px_16px_5px] bg-cream-100 text-ink"
                        : "rounded-[16px_16px_5px_16px] bg-ink text-cream"
                    }`}
                  >
                    {line.text}
                  </div>
                </div>
              </div>
            );
          })}
    </div>
  );
}

export function formatCallTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

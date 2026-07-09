"use client";

import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import { DEFAULT_PERSONA, type DemoPersona, getDemoAgent } from "@/lib/demoAgents";
import { fetchConversationToken } from "@/lib/startConversation";
import { track } from "@/lib/track";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";

type Line = { source: "user" | "ai"; text: string };

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function DemoWidget() {
  return (
    <ConversationProvider>
      <DemoStage />
    </ConversationProvider>
  );
}

function DemoStage() {
  const [persona, setPersona] = useState<DemoPersona>(DEFAULT_PERSONA);
  const [lines, setLines] = useState<Line[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      setError(null);
      setEnded(false);
    },
    onDisconnect: () => {
      setEnded(true);
      track("demo_completed", persona);
    },
    onError: () => setError("Something went wrong — please try again."),
    onMessage: ({ message, source }: { message: string; source: "user" | "ai" }) =>
      setLines((prev) => [...prev, { source, text: message }]),
  });

  const { status, isSpeaking } = conversation;
  const active = status === "connected";
  const connecting = status === "connecting";
  const busy = active || connecting;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(
    () => () => {
      if (endTimer.current) clearTimeout(endTimer.current);
    },
    [],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll must re-run when lines change
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines]);

  const start = useCallback(async () => {
    const agent = getDemoAgent(persona);
    setError(null);
    setLines([]);
    setSeconds(0);
    try {
      await navigator.mediaDevices?.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access is blocked — allow the mic in your browser and try again.");
      return;
    }
    try {
      const { token, maxDurationSeconds, dynamicVariables } = await fetchConversationToken(agent);
      conversation.startSession({
        conversationToken: token,
        connectionType: "webrtc",
        dynamicVariables,
      });
      if (endTimer.current) clearTimeout(endTimer.current);
      endTimer.current = setTimeout(() => conversation.endSession(), maxDurationSeconds * 1000);
      track("demo_started", persona);
    } catch {
      setError("The live demo isn't connected right now — please try again in a moment.");
    }
  }, [persona, conversation]);

  const end = useCallback(() => {
    if (endTimer.current) clearTimeout(endTimer.current);
    conversation.endSession();
  }, [conversation]);

  const switchPersona = (p: DemoPersona) => {
    if (p === persona) return;
    if (busy) end();
    setPersona(p);
    setLines([]);
    setSeconds(0);
    setEnded(false);
  };

  const agent = getDemoAgent(persona);
  const cool = persona === "grooming";

  const statusText = connecting
    ? "Connecting…"
    : active
      ? isSpeaking
        ? "Receptionist speaking"
        : "Listening"
      : "Ready";
  const statusDot = connecting ? "#FFB347" : active ? "#FF7A45" : "#7FD18F";

  const primaryLabel = connecting
    ? "Connecting…"
    : active
      ? "In conversation…"
      : lines.length > 0
        ? "Talk again"
        : "Talk to the receptionist";

  const orbScale = active && isSpeaking ? 1.12 : active ? 1.04 : 1;
  const ringAnim = busy ? "ringOut 2.4s ease-out infinite" : "none";
  const waveOpacity = active && !isSpeaking ? 1 : active ? 0.4 : 0.18;
  const waveAnim = busy ? "bar 0.7s ease-in-out infinite" : "none";

  return (
    <div className="grid grid-cols-1 items-stretch gap-[18px] md:grid-cols-2">
      <div className="relative flex min-h-[380px] flex-col overflow-hidden rounded-[26px] shadow-[0_30px_70px_-45px_rgba(36,27,20,0.6)] md:h-[560px]">
        <ParallaxLayer factor={0.18} style={{ position: "absolute", inset: "-8%" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url('/assets/stage-warm-bg.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              animation: "bloomDrift 17s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url('/assets/stage-cool-bg.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: cool ? 1 : 0,
              transition: "opacity 0.6s ease",
              animation: "bloomDrift 17s ease-in-out infinite",
            }}
          />
        </ParallaxLayer>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,.55) 1.2px, transparent 1.4px)",
            backgroundSize: "26px 26px",
            opacity: 0.5,
            animation: "gridDrift 26s linear infinite",
            pointerEvents: "none",
          }}
        />

        <div className="relative z-[3] flex items-start justify-between p-3 md:p-4">
          <div className="flex items-center gap-[7px] rounded-full bg-ink/30 px-3 py-1.5 text-xs text-cream backdrop-blur-md md:py-[7px]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: statusDot, boxShadow: `0 0 0 4px ${statusDot}33` }}
            />
            {statusText}
          </div>
          <fieldset className="m-0 flex flex-col gap-1 rounded-xl border-0 bg-cream/90 p-1 shadow-[0_6px_18px_-10px_rgba(36,27,20,0.5)]">
            <legend className="sr-only">Demo business type</legend>
            {(["barbershop", "grooming"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={persona === p}
                onClick={() => switchPersona(p)}
                className={`min-h-9 whitespace-nowrap rounded-[9px] px-[13px] py-2 text-xs font-medium transition-all md:min-h-[44px] md:py-[10px] ${
                  persona === p ? "bg-ink text-cream" : "bg-transparent text-muted"
                }`}
              >
                {getDemoAgent(p).label}
              </button>
            ))}
          </fieldset>
        </div>

        <div className="relative z-[2] flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-3 pt-1 md:gap-[22px] md:pb-5 md:pt-2">
          <div className="relative flex h-20 w-20 items-center justify-center md:h-32 md:w-32">
            <div
              className="absolute h-full w-full rounded-full border-[1.5px] border-white/70"
              style={{ animation: ringAnim }}
            />
            <div
              className="absolute h-full w-full rounded-full border-[1.5px] border-white/50"
              style={{ animation: busy ? "ringOut 2.4s ease-out infinite 1.2s" : "none" }}
            />
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full bg-cream/90 shadow-[inset_0_0_24px_rgba(255,255,255,0.6),0_12px_30px_-10px_rgba(36,27,20,0.5)] transition-transform duration-300 md:h-24 md:w-24"
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
                className="h-5 w-5 text-ink md:h-[34px] md:w-[34px]"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
            </div>
          </div>
          <div
            aria-hidden="true"
            className="flex h-5 items-center gap-[5px] transition-opacity duration-300 md:h-[30px]"
            style={{ opacity: waveOpacity }}
          >
            {[0, 120, 240, 360, 180, 300, 60].map((delay) => (
              <span
                key={delay}
                className="h-full w-1 origin-center rounded-[3px] bg-cream/95"
                style={{ animation: waveAnim, animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
          <div className="font-display text-xl tracking-[-0.02em] tabular-nums text-ink md:text-[30px]">
            {fmtTime(seconds)}
          </div>
        </div>

        <div className="relative z-[3] flex flex-col items-center gap-2 px-4 pb-4 md:gap-[10px] md:pb-[18px]">
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-[10px]">
            <button
              type="button"
              onClick={start}
              disabled={busy}
              className="inline-flex min-h-11 min-w-[200px] items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3 text-sm font-medium text-cream shadow-[0_14px_30px_-12px_rgba(36,27,20,0.7)] disabled:opacity-90 md:min-h-[54px] md:gap-[9px] md:rounded-[14px] md:px-[30px] md:py-[15px] md:text-base"
            >
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: statusDot }} />
              {primaryLabel}
            </button>
            {busy && (
              <button
                type="button"
                onClick={end}
                aria-label="End call"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/20 bg-ink/[0.16] px-[18px] text-sm font-medium text-ink md:min-h-[54px] md:rounded-[14px]"
              >
                End
              </button>
            )}
          </div>
          {ended && !busy && !error ? (
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[12.5px] font-medium text-ink md:text-[13.5px]">
                Want your phone to sound like this?
              </span>
              <a
                href="/onboarding"
                className="text-[12.5px] font-semibold text-ink underline underline-offset-2 md:text-[13.5px]"
              >
                Get started →
              </a>
            </div>
          ) : (
            <div className="max-w-[30ch] text-center text-[10.5px] leading-[1.35] text-ink/[0.62] md:text-[11.5px] md:leading-[1.4]">
              {error ?? "Live in-browser voice — mic permission asked on tap"}
            </div>
          )}
        </div>
      </div>

      <div className="flex h-[380px] flex-col rounded-[26px] bg-white p-[18px] shadow-[0_30px_70px_-55px_rgba(36,27,20,0.5)] md:h-[560px]">
        <div className="mb-[6px] flex items-center justify-between border-b border-cream-200 px-[6px] pb-[14px] pt-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-2">
            Transcript
          </span>
          <span className="text-xs text-muted-3">{agent.shopLabel}</span>
        </div>
        <div
          ref={transcriptRef}
          aria-live="polite"
          className="flex min-h-0 flex-1 flex-col gap-[10px] overflow-y-auto px-1 py-2"
        >
          {lines.length === 0 ? (
            <div className="m-auto flex max-w-[26ch] flex-col items-center gap-[10px] text-center text-muted-3">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="text-cream-200"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-sm leading-[1.5]">
                Tap <strong className="text-muted-2">Talk</strong> and the conversation appears
                here, line by line.
              </span>
              <div className="mt-6 flex flex-col items-center gap-[6px]">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-4">
                  Try asking
                </span>
                {agent.examplePrompts.map((prompt) => (
                  <span
                    key={prompt}
                    className="rounded-full bg-cream-100 px-[13px] py-[7px] text-[12.5px] leading-[1.4] text-muted"
                  >
                    “{prompt}”
                  </span>
                ))}
              </div>
            </div>
          ) : (
            lines.map((line, i) => {
              const ai = line.source === "ai";
              return (
                <div
                  key={`${i}-${line.text.slice(0, 8)}`}
                  className={`flex ${ai ? "justify-start" : "justify-end"}`}
                >
                  <div className="flex max-w-[82%] flex-col gap-[3px]">
                    <span
                      className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: ai ? "#B9A892" : "#c4a08a" }}
                    >
                      {ai ? "Receptionist" : "Caller"}
                    </span>
                    <div
                      className={`px-[15px] py-[11px] text-[14.5px] leading-[1.45] ${
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
            })
          )}
        </div>
      </div>
    </div>
  );
}

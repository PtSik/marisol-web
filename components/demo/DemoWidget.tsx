"use client";

import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import {
  StatusPill,
  VoiceFootnote,
  VoiceOrb,
  VoiceTranscript,
  formatCallTime,
} from "@/components/voice/VoiceStage";
import { DEFAULT_PERSONA, type DemoPersona, getDemoAgent } from "@/lib/demoAgents";
import type { Dict, Locale } from "@/lib/i18n/dict";
import { fetchConversationToken } from "@/lib/startConversation";
import { track } from "@/lib/track";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";

type Line = { source: "user" | "ai"; text: string };

type WidgetProps = { t: Dict["widget"]; personas: Dict["personas"]; locale: Locale };

export function DemoWidget({ t, personas, locale }: WidgetProps) {
  return (
    <ConversationProvider>
      <DemoStage t={t} personas={personas} locale={locale} />
    </ConversationProvider>
  );
}

function DemoStage({ t, personas, locale }: WidgetProps) {
  const [persona, setPersona] = useState<DemoPersona>(DEFAULT_PERSONA);
  const [lines, setLines] = useState<Line[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      setError(null);
      setEnded(false);
    },
    onDisconnect: () => {
      setEnded(true);
      track("demo_completed", persona);
    },
    onError: () => setError(t.errorGeneric),
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

  const start = useCallback(async () => {
    const agent = getDemoAgent(persona);
    setError(null);
    setLines([]);
    setSeconds(0);
    try {
      await navigator.mediaDevices?.getUserMedia({ audio: true });
    } catch {
      setError(t.errorMic);
      return;
    }
    try {
      const { token, maxDurationSeconds, dynamicVariables } = await fetchConversationToken(
        agent,
        locale,
      );
      conversation.startSession({
        conversationToken: token,
        connectionType: "webrtc",
        dynamicVariables,
        // Phone calls get their opening language from the shop row via the personalization
        // webhook; the widget has no shop, so the page's own locale stands in. Without this a
        // visitor on /es was greeted in English by an agent the page had just described as bilingual.
        ...(locale === "es" ? { overrides: { agent: { language: "es" } } } : {}),
      });
      if (endTimer.current) clearTimeout(endTimer.current);
      endTimer.current = setTimeout(() => conversation.endSession(), maxDurationSeconds * 1000);
      track("demo_started", persona);
    } catch {
      setError(t.errorConnect);
    }
  }, [persona, conversation, t, locale]);

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
    ? t.statusConnecting
    : active
      ? isSpeaking
        ? t.statusSpeaking
        : t.statusListening
      : t.statusReady;
  const statusDot = connecting ? "#FFB347" : active ? "#FF7A45" : "#7FD18F";

  const primaryLabel = connecting
    ? t.primaryConnecting
    : active
      ? t.primaryActive
      : lines.length > 0
        ? t.primaryAgain
        : t.primaryIdle;

  return (
    <div className="grid grid-cols-1 items-stretch gap-[18px] md:grid-cols-2">
      <div className="relative flex min-h-[380px] flex-col overflow-hidden rounded-[26px] shadow-[0_30px_70px_-45px_rgba(36,27,20,0.6)] md:h-[560px]">
        <ParallaxLayer factor={0.18} style={{ position: "absolute", inset: "-8%" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url('/assets/stage-warm-bg.webp')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              animation: "bloomDrift 17s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url('/assets/stage-cool-bg.webp')",
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

        {/* The status badge and the persona picker share one row, so the picker has to fit what is
            left of a 350px stage: at the desktop chip size "Barbershop" ran off the right edge. */}
        <div className="relative z-[3] flex items-start justify-between gap-2 p-3 md:p-4">
          <StatusPill tone="dark" dot={statusDot}>
            {statusText}
          </StatusPill>
          <fieldset className="m-0 flex flex-row gap-1 rounded-[13px] border-0 bg-cream/92 p-1 shadow-[0_8px_22px_-12px_rgba(36,27,20,0.55)] backdrop-blur-sm">
            <legend className="sr-only">{t.personaLegend}</legend>
            {(["grooming", "barbershop"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={persona === p}
                onClick={() => switchPersona(p)}
                className={`min-h-[44px] whitespace-nowrap rounded-[9px] px-[10px] py-[10px] t-caption font-medium transition-all md:px-[13px] ${
                  persona === p ? "bg-ink text-cream" : "bg-transparent text-muted"
                }`}
              >
                {personas[p].label}
              </button>
            ))}
          </fieldset>
        </div>

        <div className="relative z-[2] flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-3 pt-1 md:gap-[22px] md:pb-5 md:pt-2">
          <VoiceOrb
            tone="dark"
            active={active}
            busy={busy}
            isSpeaking={isSpeaking}
            timer={formatCallTime(seconds)}
          />
        </div>

        <div className="relative z-[3] flex flex-col items-center gap-2 px-4 pb-4 md:gap-[10px] md:pb-[18px]">
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-[10px]">
            <button
              type="button"
              onClick={start}
              disabled={busy}
              className="btn btn-sm btn-primary min-w-[200px] disabled:opacity-90 md:min-h-[54px] md:px-[30px] md:text-base"
            >
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: statusDot }} />
              {primaryLabel}
            </button>
            {busy && (
              <button
                type="button"
                onClick={end}
                aria-label={t.endAria}
                className="btn btn-sm btn-secondary md:min-h-[54px]"
              >
                {t.end}
              </button>
            )}
          </div>
          {ended && !busy && !error ? (
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="t-caption font-medium text-ink md:t-body-sm">{t.endedTitle}</span>
              <a
                href="#pricing"
                className="t-caption font-semibold text-ink underline underline-offset-2 md:t-body-sm"
              >
                {t.endedCta}
              </a>
            </div>
          ) : (
            <VoiceFootnote tone="dark">{error ?? t.footnote}</VoiceFootnote>
          )}
        </div>
      </div>

      <div className="flex h-[380px] flex-col rounded-[26px] bg-offwhite p-[18px] shadow-[0_30px_70px_-55px_rgba(36,27,20,0.5)] md:h-[560px]">
        <div className="mb-[6px] flex items-center justify-between border-b border-cream-200 px-[6px] pb-[14px] pt-1">
          <span className="t-eyebrow text-muted-2">{t.transcript}</span>
          <span className="t-caption text-muted-2">{agent.shopLabel}</span>
        </div>
        <VoiceTranscript lines={lines} speakerAi={t.speakerAi} speakerUser={t.speakerUser}>
          <div className="m-auto flex max-w-[26ch] flex-col items-center gap-[10px] text-center text-muted-2">
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
            <span className="t-body-sm">
              {t.emptyBefore}
              <strong className="text-muted-2">{t.emptyStrong}</strong>
              {t.emptyAfter}
            </span>
            <div className="mt-6 flex flex-col items-center gap-[6px]">
              <span className="t-eyebrow text-muted-2">{t.tryAsking}</span>
              {personas[persona].prompts.map((prompt) => (
                <span
                  key={prompt}
                  className="rounded-full bg-cream-100 px-[13px] py-[7px] t-caption text-muted"
                >
                  “{prompt}”
                </span>
              ))}
            </div>
          </div>
        </VoiceTranscript>
      </div>
    </div>
  );
}

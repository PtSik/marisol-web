"use client";
import {
  StatusPill,
  VoiceFootnote,
  VoiceOrb,
  VoiceTranscript,
  formatCallTime,
} from "@/components/voice/VoiceStage";
import { type Locale, getDict } from "@/lib/i18n/dict";
import type { Vertical } from "@/lib/onboarding";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useEffect, useRef, useState } from "react";

type PreviewProps = {
  locale: Locale;
  save: () => Promise<boolean>;
  businessName: string;
  vertical: Vertical;
  /** "early" runs on name and address alone; "updated" on the confirmed setup at review. */
  variant: "early" | "updated";
};

// The same two washes the landing demo runs on, picked by vertical rather than by persona chip.
const BACKDROP: Record<Vertical, string> = {
  grooming: "/assets/stage-cool-bg.webp",
  barbershop: "/assets/stage-warm-bg.webp",
};

export function OnboardingPreview(props: PreviewProps) {
  return (
    <ConversationProvider>
      <Preview {...props} />
    </ConversationProvider>
  );
}

function Preview({ locale, save, businessName, vertical, variant }: PreviewProps) {
  const t = getDict(locale).preview;
  // Rendered rather than hidden until the shop has a name: the preview is the one moment in the
  // funnel that shows what is being bought, and a component that is absent promises nothing.
  const needsName = !businessName.trim();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [lines, setLines] = useState<Array<{ source: "user" | "ai"; text: string }>>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const conversation = useConversation({
    onMessage: ({ source, message }: { source: string; message: string }) =>
      setLines((v) => [...v, { source: source === "ai" ? "ai" : "user", text: message }]),
    onError: () => setError(t.errInterrupted),
  });
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      void conversationRef.current.endSession();
    };
  }, []);
  const active = conversation.status === "connected";
  const connecting = starting || conversation.status === "connecting";
  const busy = active || connecting;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const start = async () => {
    setStarting(true);
    setError(null);
    setLines([]);
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      if (!(await save())) throw new Error("save");
      const res = await fetch(`/api/onboarding/preview?lang=${locale}`, { method: "POST" });
      if (res.status === 429) throw new Error("limit");
      if (!res.ok) throw new Error("preview");
      const body = (await res.json()) as {
        token: string;
        dynamicVariables: Record<string, string>;
        maxDurationSeconds: number;
        language?: Locale;
      };
      if (!mounted.current) return;
      await conversation.startSession({
        conversationToken: body.token,
        connectionType: "webrtc",
        dynamicVariables: body.dynamicVariables,
        overrides: { agent: { language: body.language ?? locale } },
      });
      if (!mounted.current) {
        await conversation.endSession();
        return;
      }
      timer.current = setTimeout(
        () => void conversation.endSession(),
        body.maxDurationSeconds * 1000,
      );
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error && e.message === "limit" ? t.errLimit : t.errStart);
    } finally {
      if (mounted.current) setStarting(false);
    }
  };

  const statusDot = connecting ? "#FFB347" : active ? "#FF7A45" : "#7FD18F";
  const statusText = connecting
    ? t.statusConnecting
    : active
      ? conversation.isSpeaking
        ? t.statusSpeaking
        : t.statusListening
      : t.statusReady;

  return (
    <section className="surface my-5 overflow-hidden rounded-[18px] border-teal/25">
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${BACKDROP[vertical]}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            animation: "bloomDrift 17s ease-in-out infinite",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,.55) 1.2px, transparent 1.4px)",
            backgroundSize: "26px 26px",
            opacity: 0.5,
            animation: "gridDrift 26s linear infinite",
          }}
        />
        {/* The stage copy is 13px here, not the landing's 15px, and ink on the bare wash measures
            2.7:1. Lifting the ground rather than darkening the type keeps the photograph. */}
        <div aria-hidden="true" className="absolute inset-0 bg-offwhite/35" />

        <div className="relative flex flex-col gap-3 p-[18px]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="t-body-sm font-semibold text-ink">
                {variant === "updated" ? t.titleUpdated : t.titleEarly}
              </h2>
              <p className="mt-[2px] max-w-[46ch] t-caption text-ink/80">{t.lead}</p>
            </div>
            <StatusPill tone="dark" dot={statusDot}>
              {statusText}
            </StatusPill>
          </div>

          <div className="flex flex-col items-center gap-2">
            <VoiceOrb
              tone="dark"
              compact
              active={active}
              busy={busy}
              isSpeaking={conversation.isSpeaking}
              timer={formatCallTime(seconds)}
            />
            <button
              type="button"
              disabled={needsName || connecting}
              className="btn btn-sm btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                if (active) {
                  if (timer.current) clearTimeout(timer.current);
                  void conversation.endSession();
                } else void start();
              }}
            >
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: statusDot }} />
              {active ? t.end : connecting ? t.connecting : t.start}
            </button>
            <VoiceFootnote tone="dark" className="text-ink/80">
              {needsName
                ? t.needsName
                : (error ?? (variant === "updated" ? t.noteUpdated : t.noteEarly))}
            </VoiceFootnote>
          </div>
        </div>
      </div>

      {lines.length > 0 && (
        <div className="flex max-h-[260px] flex-col border-t border-ink/[0.07] bg-offwhite px-[18px] pb-4 pt-3">
          <span className="mb-1 t-eyebrow text-muted-2">{t.transcript}</span>
          <VoiceTranscript lines={lines} speakerAi={t.speakerAi} speakerUser={t.speakerUser} />
        </div>
      )}
      {error && (
        <p role="alert" className="sr-only">
          {error}
        </p>
      )}
    </section>
  );
}

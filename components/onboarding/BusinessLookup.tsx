"use client";
import { inputCls } from "@/components/onboarding/fieldStyles";
import type { BusinessImport, BusinessMatch } from "@/lib/businessImport";
import { type Locale, getDict } from "@/lib/i18n/dict";
import { useEffect, useState } from "react";

export function BusinessLookup({
  locale,
  onImport,
  onUndo,
}: {
  locale: Locale;
  onImport: (profile: BusinessImport) => void;
  onUndo: () => void;
}) {
  const t = getDict(locale).onboarding.businessLookup;
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<BusinessMatch[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [imported, setImported] = useState<BusinessMatch | null>(null);
  useEffect(() => {
    if (imported || query.trim().length < 3) {
      setMatches([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/onboarding/business?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("search failed");
        const body = (await res.json()) as { matches: BusinessMatch[] };
        if (!controller.signal.aborted) {
          setMatches(body.matches);
          setStatus("found");
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatus("error");
          setMatches([]);
        }
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, imported]);
  const choose = async (match: BusinessMatch) => {
    setImportingId(match.id);
    try {
      const res = await fetch(`/api/onboarding/business?id=${encodeURIComponent(match.id)}`);
      if (!res.ok) throw new Error("import failed");
      const { profile } = (await res.json()) as { profile: BusinessImport };
      onImport(profile);
      setImported(match);
      setQuery("");
      setMatches([]);
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      setImportingId(null);
    }
  };
  const undo = () => {
    onUndo();
    setImported(null);
  };
  if (imported)
    return (
      <div className="surface mb-7 rounded-[18px] border-teal/30 p-5">
        <p className="t-body-sm font-semibold">{t.importedTitle}</p>
        <p className="mt-2 t-body-sm font-medium text-ink">{imported.name}</p>
        {imported.address && <p className="t-caption text-muted">{imported.address}</p>}
        <p className="mt-3 t-caption text-muted">{t.importedNote}</p>
        <div className="mt-4 flex flex-wrap gap-4">
          <button
            type="button"
            className="t-body-sm font-medium text-teal underline"
            onClick={undo}
          >
            {t.undo}
          </button>
          <button
            type="button"
            className="t-body-sm font-medium text-muted underline"
            onClick={() => setImported(null)}
          >
            {t.searchAnother}
          </button>
        </div>
      </div>
    );
  return (
    <div className="surface mb-7 rounded-[18px] p-5">
      <label htmlFor="business-search" className="block t-body-sm font-semibold">
        {t.label}
      </label>
      <p className="mb-3 mt-1 t-body-sm text-muted">{t.hint}</p>
      <input
        id="business-search"
        className={inputCls}
        value={query}
        maxLength={120}
        autoComplete="off"
        placeholder={t.placeholder}
        onChange={(e) => setQuery(e.target.value)}
        disabled={importingId !== null}
      />
      <div aria-live="polite" className="mt-3 t-body-sm text-muted">
        {status === "loading" && t.searching}
        {status === "found" && !matches.length && t.noMatch}
        {status === "error" && t.error}
      </div>
      {matches.length > 0 && (
        <ul className="mt-3 space-y-2">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="w-full rounded-xl border border-ink/10 p-3 text-left transition-colors hover:border-teal disabled:opacity-50"
                onClick={() => void choose(m)}
                disabled={importingId !== null}
              >
                <span className="block t-body-sm font-medium">{m.name}</span>
                <span className="block t-caption text-muted">
                  {importingId === m.id ? t.loadingDetails : m.address}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { RESEARCH_MAX, type SalesLead } from "@/lib/sales/leads";

// The rep researches a location outside the panel — its site, its socials, what it is missing — and
// pastes the result here, so the doc is on the same screen as the number they are about to dial.
export function ResearchDoc({ lead, back }: { lead: SalesLead; back: string }) {
  const doc = lead.research?.trim() ?? "";

  return (
    <section className="mt-4 rounded-[18px] border border-ink/10 bg-cream/80 p-5">
      <h2 className="font-display text-[19px] tracking-tight">What they need</h2>
      {doc ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{doc}</p>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Nothing written up yet — go through their site and socials first.
        </p>
      )}

      <details open={!doc} className="mt-3">
        <summary className="cursor-pointer text-sm text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">
          {doc ? "Edit" : "Write it up"}
        </summary>
        <form method="post" action={`/api/sales/leads/${lead.id}`} className="mt-2">
          <input type="hidden" name="intent" value="research" />
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="path" value={`/sales/${lead.slug}`} />
          <label htmlFor={`research-${lead.id}`} className="sr-only">
            What {lead.shop_name} needs
          </label>
          <textarea
            id={`research-${lead.id}`}
            name="research"
            rows={10}
            maxLength={RESEARCH_MAX}
            defaultValue={lead.research ?? ""}
            placeholder="Paste it in — site, socials, what they're missing, what to pitch beyond the receptionist."
            // text-base for the same reason as the note field: anything smaller makes iOS Safari
            // zoom the page on focus, and this one is tapped standing on the street.
            className="w-full rounded-[10px] border border-ink/15 bg-white px-3 py-2.5 text-base leading-relaxed"
          />
          <button
            type="submit"
            className="mt-2 rounded-[10px] bg-teal px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            Save doc
          </button>
        </form>
      </details>
    </section>
  );
}

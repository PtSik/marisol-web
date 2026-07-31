import { buildQuery } from "@/components/sales/FilterBar";
import type { SalesQuery } from "@/components/sales/FilterBar";
import { formatUsPhone } from "@/lib/sales/derive";
import { OUTCOME_LABELS, type SalesLead } from "@/lib/sales/leads";
import { contactLabel, promoCodeFor } from "@/lib/sales/offer";

const TIER_STYLE: Record<string, string> = {
  A: "bg-teal text-white",
  B: "bg-teal/15 text-teal",
  C: "bg-ink/5 text-muted",
  X: "bg-[#B3261E]/10 text-[#B3261E]",
};

const OPEN_DOT = {
  open: "bg-success",
  closed: "bg-[#B3261E]",
  unknown: "bg-muted-3",
} as const;

const CELL = "px-3 py-2 align-middle";

export function LeadTable({ leads, query }: { leads: SalesLead[]; query: SalesQuery }) {
  return (
    <div className="overflow-x-auto rounded-[18px] border border-ink/10 bg-cream/80">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-muted-2">
            <th scope="col" className={CELL}>
              Shop
            </th>
            <th scope="col" className={CELL}>
              Phone
            </th>
            <th scope="col" className={CELL}>
              Area
            </th>
            <th scope="col" className={CELL}>
              Code
            </th>
            <th scope="col" className={CELL}>
              Contact
            </th>
            <th scope="col" className={CELL}>
              State
            </th>
            <th scope="col" className={CELL}>
              <span className="sr-only">Open lead</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-ink/[0.07] last:border-0">
              <td className={CELL}>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      TIER_STYLE[lead.tier] ?? TIER_STYLE.C
                    }`}
                  >
                    {lead.tier}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 flex-none rounded-full ${OPEN_DOT[lead.openState]}`}
                  />
                  <span className="font-medium">{lead.shop_name}</span>
                </div>
              </td>
              <td className={CELL}>
                <a href={`tel:${lead.phone_e164}`} className="font-medium text-ink no-underline">
                  {formatUsPhone(lead.phone_e164)}
                </a>
              </td>
              <td className={`${CELL} text-muted`}>{lead.neighborhood}</td>
              <td className={CELL}>
                {promoCodeFor(lead.neighborhood) ? (
                  <span className="select-all font-medium">{promoCodeFor(lead.neighborhood)}</span>
                ) : (
                  <span className="text-muted-3">—</span>
                )}
              </td>
              <td className={`${CELL} ${lead.attempts === 0 ? "text-teal" : "text-[#8A5D17]"}`}>
                {contactLabel(lead.attempts)}
              </td>
              <td className={`${CELL} text-muted`}>{OUTCOME_LABELS[lead.outcome]}</td>
              <td className={CELL}>
                <a
                  href={`/sales${buildQuery(query, { mode: "focus", lead: lead.id })}`}
                  className="text-teal no-underline"
                >
                  open
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

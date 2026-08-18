import { type SalesQuery, buildQuery } from "@/components/sales/FilterBar";

export type PagerList = "queue" | "low";
type Placement = "top" | "bottom";

const NAV_LABEL: Record<PagerList, string> = {
  queue: "Pagination — call queue",
  low: "Pagination — low priority",
};

// Paging is a full navigation, so without a fragment every Next lands the rep back above the nav
// stats and the filter bar instead of on the list they were working.
const ANCHOR: Record<PagerList, string> = {
  queue: "#call-queue",
  low: "#low-priority",
};

const PAGE_PARAM: Record<PagerList, keyof SalesQuery> = {
  queue: "page",
  low: "lowPage",
};

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";

type Marker = "icon" | "text" | "arrow";

interface Variant {
  nav: string;
  status: string;
  solo: string;
  controls: string;
  active: string;
  inert: string;
  marker: Marker;
}

// The lists under the queue are secondary and share one quieter treatment.
const SECONDARY_TOP: Variant = {
  nav: "mt-2 flex flex-wrap items-center justify-between gap-2",
  status: "text-xs text-muted",
  solo: "mt-2 text-xs text-muted",
  controls: "flex items-center gap-3 text-xs",
  active: `inline-flex min-h-11 items-center text-teal no-underline ${FOCUS_RING}`,
  inert: "inline-flex min-h-11 items-center text-muted-3",
  marker: "arrow",
};

const SECONDARY_BOTTOM: Variant = {
  nav: "mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-3",
  status: "text-xs text-muted",
  solo: "mt-3 border-t border-ink/10 pt-3 text-center text-xs text-muted",
  controls: "flex items-center gap-2",
  active: `flex min-h-11 items-center rounded-[10px] border border-ink/10 px-3.5 py-2 text-xs text-muted no-underline hover:border-ink/25 ${FOCUS_RING}`,
  inert:
    "flex min-h-11 items-center rounded-[10px] border border-ink/10 px-3.5 py-2 text-xs text-muted-3",
  marker: "text",
};

const VARIANTS: Record<`${PagerList}-${Placement}`, Variant> = {
  "queue-top": {
    nav: "mt-2 flex flex-wrap items-center justify-between gap-2",
    status: "text-xs text-muted",
    solo: "mt-2 text-xs text-muted",
    controls: "flex items-center gap-2",
    active: `flex size-11 items-center justify-center rounded-[10px] border border-ink/15 bg-white text-ink no-underline hover:border-teal/40 ${FOCUS_RING}`,
    inert:
      "flex size-11 items-center justify-center rounded-[10px] border border-ink/10 text-muted-3",
    marker: "icon",
  },
  "queue-bottom": {
    nav: "mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-ink/10 bg-cream/80 px-4 py-3",
    status: "text-sm text-muted",
    solo: "mt-4 text-center text-sm text-muted",
    controls: "flex items-center gap-2",
    active: `rounded-[10px] border border-ink/15 bg-white px-4 py-3 text-sm font-medium text-ink no-underline hover:border-teal/40 ${FOCUS_RING}`,
    inert: "rounded-[10px] border border-ink/10 px-4 py-3 text-sm text-muted-3",
    marker: "text",
  },
  "low-top": SECONDARY_TOP,
  "low-bottom": SECONDARY_BOTTOM,
};

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points={dir === "prev" ? "15 6 9 12 15 18" : "9 6 15 12 9 18"} />
    </svg>
  );
}

function markerContent(marker: Marker, dir: "prev" | "next") {
  if (marker === "icon") return <Chevron dir={dir} />;
  if (marker === "text") return dir === "prev" ? "Prev" : "Next";
  return dir === "prev" ? (
    <>
      <span aria-hidden="true">‹&nbsp;</span>Prev
    </>
  ) : (
    <>
      Next<span aria-hidden="true">&nbsp;›</span>
    </>
  );
}

// An anchor has no accessible disabled state, so the first/last edge is a span of the same box
// rather than a link the keyboard can still reach.
function Edge({
  dir,
  variant,
  href,
  statusId,
}: { dir: "prev" | "next"; variant: Variant; href?: string; statusId: string }) {
  const content = markerContent(variant.marker, dir);
  if (!href) {
    return (
      <span aria-hidden="true" className={variant.inert}>
        {content}
      </span>
    );
  }
  return (
    <a
      href={href}
      // The position text is the only thing that says which page this is — Prev/Next carry no page
      // number to hang `aria-current` on — so it is read out with whichever control has focus.
      aria-describedby={statusId}
      aria-label={
        variant.marker === "icon" ? (dir === "prev" ? "Previous page" : "Next page") : undefined
      }
      className={variant.active}
    >
      {content}
    </a>
  );
}

export interface PagerProps {
  list: PagerList;
  placement: Placement;
  query: SalesQuery;
  page: number;
  totalPages: number;
  total: number;
}

export function Pager({ list, placement, query, page, totalPages, total }: PagerProps) {
  const variant = VARIANTS[`${list}-${placement}`];
  const statusId = `pager-${list}-${placement}`;

  if (totalPages <= 1) {
    return <p className={`${variant.solo} tabular-nums`}>{total} leads</p>;
  }

  const href = (target: number) => {
    const patch: SalesQuery = { [PAGE_PARAM[list]]: target > 1 ? String(target) : "" };
    return `/sales${buildQuery(query, patch)}${ANCHOR[list]}`;
  };

  return (
    <nav
      aria-label={`${NAV_LABEL[list]}${placement === "top" ? " (top)" : " (bottom)"}`}
      className={variant.nav}
    >
      <p id={statusId} className={`${variant.status} whitespace-nowrap tabular-nums`}>
        Page {page} of {totalPages} <span aria-hidden="true">·</span>
        <span className="sr-only">,</span> {total} leads
      </p>
      <div className={variant.controls}>
        <Edge
          dir="prev"
          variant={variant}
          statusId={statusId}
          href={page > 1 ? href(page - 1) : undefined}
        />
        <Edge
          dir="next"
          variant={variant}
          statusId={statusId}
          href={page < totalPages ? href(page + 1) : undefined}
        />
      </div>
    </nav>
  );
}

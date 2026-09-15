// 16px is the iOS Safari zoom-on-focus threshold — anything smaller makes the browser zoom the
// whole page in when a rep or customer taps into the field, and it doesn't reliably zoom back out.
export const inputCls =
  "w-full min-h-[48px] rounded-[12px] border border-ink/15 bg-offwhite px-4 py-3 text-base text-ink transition-colors placeholder:text-muted-3 hover:border-ink/25";

// The tiles the wizard uses to pick a vertical, a calendar and a language mode. They were three
// hand-rolled copies of the same border-and-fill pair, which is how they drifted apart.
export const choiceCls = (active: boolean) =>
  `flex cursor-pointer items-start gap-3 rounded-[16px] border px-[18px] py-4 text-left transition-colors ${
    active ? "border-ink bg-offwhite" : "border-ink/12 bg-cream-100/70 hover:border-ink/25"
  }`;

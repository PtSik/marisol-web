function CheckIcon() {
  return (
    <span className="inline-flex h-[54px] w-[54px] items-center justify-center rounded-full bg-success/10 text-success">
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

export interface AccentTitle {
  before: string;
  accent: string;
}

export function ThanksHeading({ title, lead }: { title: AccentTitle; lead: string }) {
  return (
    <div className="text-center">
      <CheckIcon />
      <h1 className="mx-auto mt-5 max-w-[20ch] font-display t-h2 font-bold text-balance">
        {title.before}
        <span className="text-teal">{title.accent}</span>
      </h1>
      <p className="mx-auto mt-[14px] max-w-[44ch] t-body text-muted">{lead}</p>
    </div>
  );
}

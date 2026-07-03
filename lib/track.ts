export type FunnelEvent =
  | "demo_started"
  | "demo_completed"
  | "wizard_step"
  | "checkout_redirect"
  | "setup_completed";

export function track(event: FunnelEvent, meta?: string): void {
  try {
    const body = JSON.stringify({ event, meta });
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/track", blob)) return;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics must never break the page */
  }
}

import { env } from "cloudflare:workers";
import { RESEARCH_MAX, isOutcome, recordOutcome, saveResearch } from "@/lib/sales/leads";
import {
  SALES_COOKIE,
  SALES_REP_COOKIE,
  isSalesCookieValid,
  normaliseRep,
  salesReturnTo,
} from "@/lib/salesAuth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface SalesEnv {
  OUTREACH_DB?: D1Database;
  SALES_DASH_KEY?: string;
}

// Every write is a plain form POST, so the rep keeps working on a flaky connection with no
// JavaScript. `back` carries the filters the rep had open so they land on the same view, and `path`
// keeps a write made on a lead's own page on that page rather than throwing them back to the queue.
function redirect(request: Request, form: FormData | null, notice: string): Response {
  const rawBack = form?.get("back");
  const query = typeof rawBack === "string" && rawBack.startsWith("?") ? rawBack : "";
  const rawPath = form?.get("path");
  const path = typeof rawPath === "string" ? rawPath : "/sales";
  const url =
    salesReturnTo(`${path}${query}`, request.url) ?? new URL(`/sales${query}`, request.url);
  url.searchParams.set("saved", notice);
  return Response.redirect(url.toString(), 303);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const cfEnv = env as unknown as SalesEnv;
  const jar = await cookies();
  if (!(await isSalesCookieValid(jar.get(SALES_COOKIE)?.value, cfEnv.SALES_DASH_KEY))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!cfEnv.OUTREACH_DB || !form) return redirect(request, form, "failed");

  const { id } = await params;
  const cookieRep = jar.get(SALES_REP_COOKIE)?.value;
  const actor = normaliseRep(cookieRep && decodeURIComponent(cookieRep)) ?? "unknown";

  const intent = form.get("intent");
  if (intent === "research") {
    const research = form.get("research");
    if (typeof research !== "string") return redirect(request, form, "failed");
    await saveResearch(cfEnv.OUTREACH_DB, id, research.slice(0, RESEARCH_MAX), actor);
    return redirect(request, form, "research-saved");
  }
  const outcome = form.get("outcome");
  if (!isOutcome(outcome)) return redirect(request, form, "failed");

  const note = form.get("note");
  const followup = form.get("next_followup");
  await recordOutcome(cfEnv.OUTREACH_DB, id, {
    outcome,
    actor,
    note: typeof note === "string" && note.trim() ? note.trim() : undefined,
    nextFollowup: typeof followup === "string" && followup ? followup : undefined,
  });
  return redirect(request, form, "saved");
}

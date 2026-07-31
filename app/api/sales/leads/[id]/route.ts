import { env } from "cloudflare:workers";
import { cancelDemo, isOutcome, recordOutcome, requestDemo } from "@/lib/sales/leads";
import { SALES_COOKIE, SALES_REP_COOKIE, isSalesCookieValid, normaliseRep } from "@/lib/salesAuth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface SalesEnv {
  OUTREACH_DB?: D1Database;
  SALES_DASH_KEY?: string;
}

// Every write is a plain form POST, so the rep keeps working on a flaky connection with no
// JavaScript. `back` carries the filters the rep had open so they land on the same view.
function redirect(request: Request, form: FormData | null, notice: string): Response {
  const raw = form?.get("back");
  const query = typeof raw === "string" && raw.startsWith("?") ? raw : "";
  const url = new URL(`/sales${query}`, request.url);
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
  if (intent === "demo") {
    const lang = form.get("demo_lang");
    if (lang !== "en" && lang !== "es") return redirect(request, form, "failed");
    await requestDemo(cfEnv.OUTREACH_DB, id, lang, actor);
    return redirect(request, form, `demo-${lang}`);
  }
  if (intent === "demo_cancel") {
    await cancelDemo(cfEnv.OUTREACH_DB, id, actor);
    return redirect(request, form, "demo-cancelled");
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

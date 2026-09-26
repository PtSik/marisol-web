import { changeScheduledCancellation } from "@/lib/scheduledCancellation";

export const dynamic = "force-dynamic";

export const POST = (request: Request): Promise<Response> =>
  changeScheduledCancellation(request, "resume");

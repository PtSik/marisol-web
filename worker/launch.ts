import handler from "vinext/server/app-router-entry";
import { type CancellationEnv, runCancellationJobs } from "../lib/cancellation";

export default {
  fetch: handler.fetch,
  async scheduled(
    _controller: ScheduledController,
    env: CancellationEnv,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runCancellationJobs(env));
  },
};

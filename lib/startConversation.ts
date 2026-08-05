import type { DemoAgent } from "@/lib/demoAgents";
import type { Locale } from "@/lib/i18n/dict";

export interface ConversationToken {
  token: string;
  maxDurationSeconds: number;
  dynamicVariables: Record<string, string>;
}

export async function fetchConversationToken(
  agent: DemoAgent,
  locale: Locale = "en",
): Promise<ConversationToken> {
  const res = await fetch(
    `/api/elevenlabs/token?agent_id=${encodeURIComponent(agent.agentId)}&lang=${locale}`,
  );
  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status}`);
  }
  return (await res.json()) as ConversationToken;
}

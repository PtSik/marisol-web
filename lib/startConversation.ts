import type { DemoAgent } from "@/lib/demoAgents";

export interface ConversationToken {
  token: string;
  maxDurationSeconds: number;
  dynamicVariables: Record<string, string>;
}

export async function fetchConversationToken(agent: DemoAgent): Promise<ConversationToken> {
  const res = await fetch(`/api/elevenlabs/token?agent_id=${encodeURIComponent(agent.agentId)}`);
  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status}`);
  }
  return (await res.json()) as ConversationToken;
}

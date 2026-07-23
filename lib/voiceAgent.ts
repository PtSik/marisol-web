export interface VoiceAgentEnv {
  VOICE_AGENT_API?: Fetcher;
  VOICE_AGENT_API_URL?: string;
  ADMIN_API_KEY?: string;
}

export async function voiceAgentFetch(
  env: VoiceAgentEnv,
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  if (!env.VOICE_AGENT_API_URL || !env.ADMIN_API_KEY) return null;
  const url = `${env.VOICE_AGENT_API_URL}${path}`;
  const withAuth: RequestInit = {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.ADMIN_API_KEY}`,
    },
  };
  return env.VOICE_AGENT_API ? env.VOICE_AGENT_API.fetch(url, withAuth) : fetch(url, withAuth);
}

export type DemoPersona = "barbershop" | "grooming";

export interface DemoAgent {
  persona: DemoPersona;
  label: string;
  shopLabel: string;
  agentId: string;
  shopId: string;
  calledNumber: string;
  examplePrompts: string[];
}

export const DEMO_AGENTS: DemoAgent[] = [
  {
    persona: "barbershop",
    label: "Barbershop",
    shopLabel: "Kaijiro Barbershop",
    agentId: "agent_8301ks8brwmbedw8nv1sgnwwcdfw",
    shopId: "4d5815c1-c77a-43cc-8df4-1b0b7be6c896",
    calledNumber: "+18336596941",
    examplePrompts: ["Can I book a haircut with anyone tomorrow?"],
  },
  {
    persona: "grooming",
    label: "Pet grooming",
    shopLabel: "Kaijiro Pet Spa",
    agentId: "agent_2501ktmhtm2wf8789jqdtkbj7jdr",
    shopId: "da61e1fa-787a-4069-b3a6-246bd95144da",
    calledNumber: "+18788678115",
    examplePrompts: ["Can I get a full groom for a small dog this week?"],
  },
];

export const DEFAULT_PERSONA: DemoPersona = "barbershop";

export function getDemoAgent(persona: DemoPersona): DemoAgent {
  const found = DEMO_AGENTS.find((a) => a.persona === persona);
  if (!found) throw new Error(`No demo agent for persona: ${persona}`);
  return found;
}

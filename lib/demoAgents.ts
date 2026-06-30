export type DemoPersona = "barbershop" | "grooming";

export interface DemoAgent {
  persona: DemoPersona;
  label: string;
  shopLabel: string;
  agentId: string;
  shopId: string;
}

export const DEMO_AGENTS: DemoAgent[] = [
  {
    persona: "barbershop",
    label: "Barbershop",
    shopLabel: "Kaijiro Barbershop",
    agentId: "",
    shopId: "",
  },
  {
    persona: "grooming",
    label: "Pet grooming",
    shopLabel: "Kaijiro Pet Spa",
    agentId: "",
    shopId: "",
  },
];

export const DEFAULT_PERSONA: DemoPersona = "barbershop";

export function getDemoAgent(persona: DemoPersona): DemoAgent {
  const found = DEMO_AGENTS.find((a) => a.persona === persona);
  if (!found) throw new Error(`No demo agent for persona: ${persona}`);
  return found;
}

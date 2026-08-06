import type { DemoPersona } from "@/lib/demoAgents";
import type { ServiceEntry } from "@/lib/onboarding";

// The service menus the demo shops answer from. Kept here rather than typed into the admin API by
// hand so a demo that drifts can be re-seeded from a reviewed source (scripts/seed-demo-services.ts).
//
// Prices are mid-market US independent (2026): above the big-box chains, below Manhattan. The point
// is a menu that survives a prospect's questions — the call recordings show callers asking for a
// skin fade, a buzz cut and a price four times over, against a shop that had none of them listed.

// Flat values throughout: a barber's cut takes the same time on everyone, and the contrast with the
// grooming menu below is what makes the range feature legible in a demo.
const BARBERSHOP: ServiceEntry[] = [
  { name: "Haircut", durationMin: "30", price: "35" },
  { name: "Skin Fade", durationMin: "40", price: "40" },
  { name: "Buzz Cut", durationMin: "20", price: "25" },
  { name: "Beard Trim", durationMin: "20", price: "20" },
  { name: "Haircut + Beard", durationMin: "45", price: "50" },
  { name: "Hot Towel Shave", durationMin: "30", price: "40" },
  { name: "Haircut + Hot Towel Shave", durationMin: "60", price: "70" },
  { name: "Line-Up", durationMin: "15", price: "15" },
  { name: "Kids Cut (under 12)", durationMin: "30", price: "25" },
  { name: "Senior Cut (65+)", durationMin: "30", price: "25" },
];

// Ranges throughout, because that is the truth for grooming: the same full groom is 75 minutes on a
// Yorkie and three hours on a matted Bernedoodle. Doodles get their own line — the industry prices
// and books them separately, and a demo that knows that lands with a real groomer.
const GROOMING: ServiceEntry[] = [
  {
    name: "Bath & Brush",
    durationMin: "45",
    durationMaxMin: "90",
    price: "45",
    priceMax: "85",
  },
  {
    name: "Bath & Tidy",
    durationMin: "60",
    durationMaxMin: "120",
    price: "55",
    priceMax: "95",
  },
  {
    name: "Full Groom",
    durationMin: "75",
    durationMaxMin: "180",
    price: "65",
    priceMax: "135",
  },
  {
    name: "Doodle & Poodle Full Groom",
    durationMin: "120",
    durationMaxMin: "240",
    price: "95",
    priceMax: "175",
  },
  { name: "Puppy's First Groom", durationMin: "45", durationMaxMin: "60", price: "45" },
  {
    name: "De-Shedding Treatment",
    durationMin: "60",
    durationMaxMin: "120",
    price: "55",
    priceMax: "95",
  },
  {
    name: "De-Matting",
    durationMin: "30",
    durationMaxMin: "60",
    price: "25",
    priceMax: "60",
  },
  {
    name: "Flea & Tick Bath",
    durationMin: "60",
    durationMaxMin: "90",
    price: "65",
    priceMax: "95",
  },
  { name: "Nail Trim", durationMin: "15", price: "15" },
  { name: "Nail Grind", durationMin: "20", price: "20" },
  { name: "Teeth Brushing", durationMin: "10", price: "12" },
  { name: "Ear Cleaning", durationMin: "10", price: "10" },
];

export const DEMO_SERVICES: Record<DemoPersona, ServiceEntry[]> = {
  barbershop: BARBERSHOP,
  grooming: GROOMING,
};

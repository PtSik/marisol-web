import { afterEach, describe, expect, it } from "bun:test";
import { buyLocalNumber, lookupNumberSid, releaseTwilioNumber, toUsE164 } from "@/lib/twilio";

const originalFetch = globalThis.fetch;
const env = { TWILIO_ACCOUNT_SID: "AC-test", TWILIO_AUTH_TOKEN: "secret" };

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("toUsE164", () => {
  it("canonicalizes common US formatting", () => {
    expect(toUsE164("+1 (305) 555-0199")).toBe("+13055550199");
    expect(toUsE164("305-555-0199")).toBe("+13055550199");
  });

  it("rejects ambiguous or non-US numbers", () => {
    expect(toUsE164("555-0199")).toBeNull();
    expect(toUsE164("+48 600 100 200")).toBeNull();
  });
});

describe("buyLocalNumber", () => {
  it("never falls through to an unfiltered US inventory request", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      urls.push(String(input));
      return Response.json({ available_phone_numbers: [] });
    }) as typeof fetch;

    const result = await buyLocalNumber(
      env,
      { areaCode: "305", nearNumber: "+13055550199" },
      "https://voice.test/twilio/inbound",
    );

    expect(result).toBeNull();
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("AreaCode=305");
    expect(urls[1]).toContain("NearNumber=%2B13055550199");
    expect(urls.every((url) => url.includes("AreaCode=") || url.includes("NearNumber="))).toBe(
      true,
    );
  });

  it("records which approved search strategy found the purchased number", async () => {
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes("AvailablePhoneNumbers")) {
        return Response.json({ available_phone_numbers: [{ phone_number: "+13055550123" }] });
      }
      return Response.json({ phone_number: "+13055550123", sid: "PN123" });
    }) as typeof fetch;

    await expect(
      buyLocalNumber(env, { areaCode: "305" }, "https://voice.test/twilio/inbound"),
    ).resolves.toEqual({ number: "+13055550123", sid: "PN123", match: "areaCode" });
  });

  it("fails closed when a lost purchase response cannot prove whether Twilio owns the number", async () => {
    let calls = 0;
    globalThis.fetch = (async (input) => {
      calls += 1;
      const url = String(input);
      if (url.includes("AvailablePhoneNumbers")) {
        return Response.json({ available_phone_numbers: [{ phone_number: "+13055550123" }] });
      }
      if (url.includes("IncomingPhoneNumbers.json?")) {
        return Response.json({ incoming_phone_numbers: [] });
      }
      throw new Error("response lost");
    }) as typeof fetch;

    await expect(
      buyLocalNumber(env, { areaCode: "305" }, "https://voice.test/twilio/inbound"),
    ).resolves.toEqual({
      uncertain: true,
      number: "+13055550123",
      reason: "Twilio purchase response lost",
    });
    expect(calls).toBe(3);
  });

  it("cleans up a purchase found during immediate ambiguity reconciliation", async () => {
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (url.includes("AvailablePhoneNumbers")) {
        return Response.json({ available_phone_numbers: [{ phone_number: "+13055550123" }] });
      }
      if (url.endsWith("/IncomingPhoneNumbers.json") && init?.method === "POST") {
        return new Response(null, { status: 500 });
      }
      if (url.includes("IncomingPhoneNumbers.json?")) {
        return Response.json({ incoming_phone_numbers: [{ sid: "PN123" }] });
      }
      if (url.includes("IncomingPhoneNumbers/PN123.json")) {
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 500 });
    }) as typeof fetch;

    await expect(
      buyLocalNumber(env, { areaCode: "305" }, "https://voice.test/twilio/inbound"),
    ).resolves.toBeNull();
  });
});

describe("Twilio number cleanup", () => {
  it("accepts successful and already-gone deletes", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    expect(await releaseTwilioNumber(env, "PN123")).toBe(true);

    globalThis.fetch = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch;
    expect(await releaseTwilioNumber(env, "PN123")).toBe(true);
  });

  it("does not report an HTTP or network failure as released", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch;
    expect(await releaseTwilioNumber(env, "PN123")).toBe(false);

    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    expect(await releaseTwilioNumber(env, "PN123")).toBe(false);
  });

  it("distinguishes an absent legacy number from a failed lookup", async () => {
    globalThis.fetch = (async () =>
      Response.json({ incoming_phone_numbers: [] })) as unknown as typeof fetch;
    expect(await lookupNumberSid(env, "+13055550123")).toBeNull();

    globalThis.fetch = (async () => new Response(null, { status: 401 })) as unknown as typeof fetch;
    await expect(lookupNumberSid(env, "+13055550123")).rejects.toThrow("(401)");
  });
});

for (const payload of [
  null,
  {},
  { incoming_phone_numbers: null },
  { incoming_phone_numbers: [{}] },
  { incoming_phone_numbers: [{ sid: "" }] },
  { incoming_phone_numbers: [{ sid: "PN1" }, { sid: "PN2" }] },
]) {
  it(`rejects an ambiguous lookup: ${JSON.stringify(payload)}`, async () => {
    globalThis.fetch = (async () => Response.json(payload)) as unknown as typeof fetch;
    await expect(lookupNumberSid(env, "+13055550123")).rejects.toThrow("Invalid Twilio");
  });
}
it("rejects malformed JSON instead of declaring a number absent", async () => {
  globalThis.fetch = (async () => new Response("invalid JSON")) as unknown as typeof fetch;
  await expect(lookupNumberSid(env, "+13055550123")).rejects.toThrow("Invalid Twilio");
});

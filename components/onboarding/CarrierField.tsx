"use client";

import { Field } from "@/components/onboarding/Field";
import { inputCls } from "@/components/onboarding/fieldStyles";
import { CARRIERS, type Carrier } from "@/lib/forwarding";
import { type Dict, fill } from "@/lib/i18n/dict";
import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 600;

function isUsNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

// Owners know who bills them, not whose network they are on — and the two differ for every reseller
// (Visible bills you, Verizon's codes are the ones that work). The lookup answers the question they
// can't, and the select stays because a lookup that comes back unsure must not become a guess.
export function CarrierField({
  forwardNumber,
  carrier,
  t,
  onChange,
}: {
  forwardNumber: string;
  carrier?: Carrier;
  t: Dict["setup"];
  onChange: (carrier: Carrier) => void;
}) {
  const [picked, setPicked] = useState(false);
  const [detected, setDetected] = useState<Carrier | null>(null);
  const [checking, setChecking] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Whether the carrier the parent holds is one we detected. A detection that no longer stands must
  // be taken back, or the previous number's carrier silently becomes the dial code in the welcome
  // email — the wrong-code failure this field exists to remove.
  const appliedRef = useRef(false);

  useEffect(() => {
    const withdrawDetection = () => {
      if (!appliedRef.current) return;
      appliedRef.current = false;
      onChangeRef.current("unknown");
    };

    if (picked || !isUsNumber(forwardNumber)) {
      setDetected(null);
      setChecking(false);
      withdrawDetection();
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await fetch("/api/carrier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: forwardNumber }),
          signal: controller.signal,
        });
        const body = (await res.json()) as { carrier?: Carrier | null };
        if (controller.signal.aborted) return;
        if (body.carrier) {
          appliedRef.current = true;
          onChangeRef.current(body.carrier);
          setDetected(body.carrier);
        } else {
          setDetected(null);
          withdrawDetection();
        }
      } catch {
        /* the select is still there, so a failed lookup costs the owner nothing */
      }
      if (!controller.signal.aborted) setChecking(false);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [forwardNumber, picked]);

  const hint = checking
    ? t.carrierDetecting
    : detected
      ? fill(t.carrierDetected, { carrier: t.carrierShort[detected] })
      : t.carrierHint;

  return (
    <Field label={t.carrier} htmlFor="ob-carrier" hint={hint} liveHint>
      <select
        id="ob-carrier"
        className={`${inputCls} max-w-[420px]`}
        value={carrier ?? "unknown"}
        onChange={(e) => {
          setPicked(true);
          setDetected(null);
          setChecking(false);
          appliedRef.current = false;
          onChange(e.target.value as Carrier);
        }}
      >
        {CARRIERS.map((id) => (
          <option key={id} value={id}>
            {t.carrierOptions[id]}
          </option>
        ))}
      </select>
    </Field>
  );
}

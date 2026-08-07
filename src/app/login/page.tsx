"use client";

/**
 * Login — phone + PIN, per docs/design.md's form rules: single column,
 * labels above, validation on blur, input preserved on failure.
 *
 * Staff use their own phones mid-service (docs/architecture.md), so this
 * page has to work as a small, thumb-usable form, not a marketing-style
 * split screen. Visual composition lives in login-form.tsx, reviewed and
 * approved via the Storybook checkpoint in .claude/skills/build/SKILL.md
 * before this route existed.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "./login-form";

type FieldErrors = { phone?: string; pin?: string };

function validate(phone: string, pin: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!phone.trim()) errors.phone = "Enter your phone number";
  if (!/^\d{4}$/.test(pin)) errors.pin = "PIN is 4 digits";
  return errors;
}

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [touched, setTouched] = useState<{ phone?: boolean; pin?: boolean }>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const errors = validate(phone, pin);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ phone: true, pin: true });
    if (errors.phone || errors.pin) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });

      if (!response.ok) {
        // Same message for a wrong PIN and an unknown phone — no enumeration leak.
        setFormError("Wrong phone number or PIN.");
        setSubmitting(false);
        return;
      }

      router.push("/staff");
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <LoginForm
      phone={phone}
      pin={pin}
      phoneError={touched.phone ? errors.phone : undefined}
      pinError={touched.pin ? errors.pin : undefined}
      formError={formError}
      submitting={submitting}
      onPhoneChange={setPhone}
      onPinChange={setPin}
      onPhoneBlur={() => setTouched((t) => ({ ...t, phone: true }))}
      onPinBlur={() => setTouched((t) => ({ ...t, pin: true }))}
      onSubmit={handleSubmit}
    />
  );
}

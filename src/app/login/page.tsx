"use client";

/**
 * Login — name + PIN, per docs/design.md's form rules: single column,
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

type FieldErrors = { name?: string; pin?: string };

function validate(name: string, pin: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim()) errors.name = "Enter your name";
  if (!/^\d{4}$/.test(pin)) errors.pin = "PIN is 4 digits";
  return errors;
}

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [touched, setTouched] = useState<{ name?: boolean; pin?: boolean }>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const errors = validate(name, pin);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, pin: true });
    if (errors.name || errors.pin) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });

      if (!response.ok) {
        // Same message for a wrong PIN and an unknown name — no enumeration leak.
        setFormError("Wrong name or PIN.");
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
      name={name}
      pin={pin}
      nameError={touched.name ? errors.name : undefined}
      pinError={touched.pin ? errors.pin : undefined}
      formError={formError}
      submitting={submitting}
      onNameChange={setName}
      onPinChange={setPin}
      onNameBlur={() => setTouched((t) => ({ ...t, name: true }))}
      onPinBlur={() => setTouched((t) => ({ ...t, pin: true }))}
      onSubmit={handleSubmit}
    />
  );
}

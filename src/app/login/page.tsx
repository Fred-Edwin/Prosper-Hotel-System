"use client";

/**
 * Login — phone + PIN, per docs/design.md's form rules: single column,
 * labels above, validation on blur, input preserved on failure.
 *
 * Staff use their own phones mid-service (docs/architecture.md), so this
 * page has to work as a small, thumb-usable form, not a marketing-style
 * split screen.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/patterns/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xs space-y-4"
        data-testid="login-form"
      >
        <div className="mb-2 text-center">
          <div className="text-[15px] font-semibold">Prosper Hotel</div>
          <div className="text-[11px] text-muted-foreground">
            Sign in with your phone and PIN
          </div>
        </div>

        {formError && (
          <p role="alert" className="text-xs text-danger" data-testid="login-error">
            {formError}
          </p>
        )}

        <Field
          label="Phone number"
          error={touched.phone ? errors.phone : undefined}
        >
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            data-testid="login-phone"
          />
        </Field>

        <Field label="PIN" error={touched.pin ? errors.pin : undefined}>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onBlur={() => setTouched((t) => ({ ...t, pin: true }))}
            data-testid="login-pin"
          />
        </Field>

        <Button
          type="submit"
          className="h-9 w-full"
          disabled={submitting}
          data-testid="login-submit"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

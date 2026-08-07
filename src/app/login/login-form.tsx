"use client";

/**
 * Login form — the presentational half, split from LoginPage so it can be
 * rendered in Storybook for visual review before shipping (see
 * .claude/skills/build/SKILL.md's checkpoint). No design-phase screen
 * covered auth, so this composition was reviewed and approved directly
 * rather than assumed from precedent.
 *
 * v2: the first version was a bare form floating on an empty page — every
 * checkable UI-RULES.md rule passed, but it read as amateur because nothing
 * gave it visual weight. Fixed with a Card (real elevation, not a shadow —
 * flat surfaces use a border/ring per the rules) and a location strip that
 * gives the page actual content instead of a form alone on a blank page.
 */

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/patterns/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type LoginFormProps = {
  phone: string;
  pin: string;
  phoneError?: string;
  pinError?: string;
  formError?: string | null;
  submitting?: boolean;
  onPhoneChange: (v: string) => void;
  onPinChange: (v: string) => void;
  onPhoneBlur: () => void;
  onPinBlur: () => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function LoginForm({
  phone,
  pin,
  phoneError,
  pinError,
  formError,
  submitting,
  onPhoneChange,
  onPinChange,
  onPhoneBlur,
  onPinBlur,
  onSubmit,
}: LoginFormProps) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        {/* The real logo already carries the wordmark and tagline, so it
            stands alone rather than repeating "Prosper Hotel" as separate
            type underneath it — two statements of the same fact would make
            the weaker one read as filler (docs/design.md's own rule for
            summary strips, applied here). It's the one piece of brand
            identity on the page, given real size rather than squeezed into
            an icon-sized slot — a decorative badge logo with fine linework
            and a tagline is illegible at 44px. */}
        <div className="mb-5 flex justify-center">
          <Image
            src="/prosper-hotel-logo.jpeg"
            alt="Prosper Hotel"
            width={112}
            height={112}
            priority
            className="rounded-full ring-1 ring-foreground/10"
          />
        </div>

        <Card className="ring-1 ring-foreground/10">
          <CardContent className="pt-1">
            <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
              <div>
                <div className="text-[15px] font-semibold">Sign in</div>
                <div className="text-[13px] text-muted-foreground">
                  Use the phone and PIN the owner gave you
                </div>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="rounded-md bg-danger-subtle px-3 py-2 text-[13px] text-danger"
                  data-testid="login-error"
                >
                  {formError}
                </p>
              )}

              <Field label="Phone number" error={phoneError}>
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="07XX XXX XXX"
                  value={phone}
                  onChange={(e) => onPhoneChange(e.target.value)}
                  onBlur={onPhoneBlur}
                  data-testid="login-phone"
                />
              </Field>

              <Field label="PIN" error={pinError}>
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => onPinChange(e.target.value.replace(/\D/g, ""))}
                  onBlur={onPinBlur}
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
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          Forgotten your PIN? Ask the owner to reset it.
        </p>
      </div>

      {/* Vendor attribution — quiet page furniture, not part of the sign-in
          task. Scoped to this screen only; the staff/admin shells have
          their own settled chrome from Design and get this decision made
          separately if it's ever needed there. */}
      <p className="absolute inset-x-0 bottom-4 px-4 text-center text-[11px] text-muted-foreground">
        Powered by Lobster Technologies ·{" "}
        <a
          href="mailto:lobster.technologies.africa@gmail.com"
          className="underline-offset-2 hover:underline"
        >
          lobster.technologies.africa@gmail.com
        </a>{" "}
        · +254 113 176 613
      </p>
    </div>
  );
}

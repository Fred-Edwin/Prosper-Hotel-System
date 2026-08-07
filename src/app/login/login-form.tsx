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
 *
 * v3: restyled against the client's own reference screen. The footer band
 * carries the brand-purple gradient the client specified by exact hex
 * (`--color-surface-dark` → `--brand-800`, 165deg) rather than a token ramp
 * step, because it was supplied as a literal gradient, not a colour to
 * derive one from. Gold (`--color-brand-accent`) is scoped to this dark
 * ground only, per docs/design.md's "companion accent, dark surfaces only"
 * rule — it must never leak onto the light card above it.
 */

import Image from "next/image";
import { MessageCircle, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/patterns/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type LoginFormProps = {
  name: string;
  pin: string;
  nameError?: string;
  pinError?: string;
  formError?: string | null;
  submitting?: boolean;
  onNameChange: (v: string) => void;
  onPinChange: (v: string) => void;
  onNameBlur: () => void;
  onPinBlur: () => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function LoginForm({
  name,
  pin,
  nameError,
  pinError,
  formError,
  submitting,
  onNameChange,
  onPinChange,
  onNameBlur,
  onPinBlur,
  onSubmit,
}: LoginFormProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* The real logo already carries the wordmark and tagline, so it
              stands alone rather than repeating "Prosper Hotel" as separate
              type underneath it — two statements of the same fact would make
              the weaker one read as filler (docs/design.md's own rule for
              summary strips, applied here). */}
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

          <div className="mb-5 text-center">
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-[13px] text-muted-foreground">
              Prosper Hotel Management System
            </p>
          </div>

          <Card className="ring-1 ring-foreground/10">
            <CardContent className="pt-1">
              <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
                {formError && (
                  <p
                    role="alert"
                    className="rounded-md bg-danger-subtle px-3 py-2 text-[13px] text-danger"
                    data-testid="login-error"
                  >
                    {formError}
                  </p>
                )}

                <Field label="Name" error={nameError}>
                  <Input
                    type="text"
                    autoComplete="name"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    onBlur={onNameBlur}
                    data-testid="login-name"
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
      </div>

      {/* Vendor footer — the client's exact gradient and hexes, not a token
          ramp step. Scoped to this screen only; the staff/admin shells have
          their own settled chrome from Design and get this decision made
          separately if it's ever needed there. */}
      <footer
        className="flex flex-col items-center gap-2 px-4 py-5"
        style={{
          background:
            "linear-gradient(165deg, var(--color-surface-dark), var(--brand-800))",
        }}
      >
        <div
          className="flex items-center gap-4 text-[13px]"
          style={{ color: "rgba(255,255,255,0.68)" }}
        >
          <a href="tel:+254113176613" className="flex items-center gap-1.5 hover:text-white">
            <MessageCircle
              className="size-4"
              style={{ color: "var(--color-brand-accent)" }}
            />
            0113 176 613
          </a>
          <a
            href="mailto:lobster.technologies.africa@gmail.com"
            className="flex items-center gap-1.5 hover:text-white"
          >
            <Mail className="size-4" style={{ color: "var(--color-brand-accent)" }} />
            Contact support
          </a>
        </div>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
          Developed by{" "}
          <span style={{ color: "var(--color-brand-accent)" }} className="font-semibold">
            Lobster Technologies
          </span>
        </p>
      </footer>
    </div>
  );
}

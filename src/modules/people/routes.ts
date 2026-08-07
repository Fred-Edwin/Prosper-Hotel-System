import { cookies } from "next/headers";
import { db } from "@/shared/db";
import { getAuthenticatedStaff, login, logout } from "./logic";
import type { AuthenticatedStaff } from "./logic";

const SESSION_COOKIE = "prosper_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days, matches logic.ts

export async function loginRoute(request: Request): Promise<Response> {
  const body = await request.json();
  const phone = typeof body.phone === "string" ? body.phone : "";
  const pin = typeof body.pin === "string" ? body.pin : "";

  const result = await login(db, phone, pin);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return Response.json({ staff: result.staff });
}

export async function logoutRoute(): Promise<Response> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await logout(db, token);
  cookieStore.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}

// The one place a server component/route asks "who is logged in".
export async function getSession(): Promise<AuthenticatedStaff | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getAuthenticatedStaff(db, token);
}

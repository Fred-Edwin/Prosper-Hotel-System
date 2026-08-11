import { cookies } from "next/headers";
import { db } from "@/shared/db";
import {
  createCustomer,
  createStaffMember,
  deactivateStaffMember,
  getAuthenticatedStaff,
  getPayForStaff,
  listCustomers,
  listDaysWorkedForStaff,
  listStaffMembers,
  login,
  logout,
  reactivateStaffMember,
  recordDaysWorked,
  updateStaffMember,
} from "./logic";
import { listLocations } from "./queries";
import type { AuthenticatedStaff } from "./logic";

const SESSION_COOKIE = "prosper_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days, matches logic.ts

function writeStatus(reason: string): number {
  if (reason === "forbidden") return 403;
  if (reason === "not_found") return 404;
  return 400;
}

export async function loginRoute(request: Request): Promise<Response> {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name : "";
  const pin = typeof body.pin === "string" ? body.pin : "";

  const result = await login(db, name, pin);
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

// Any staff member may pick or create a customer, e.g. attaching one to a
// credit payment line at the till — same "no owner gate" rule as
// createCustomer itself.
export async function listCustomersRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const customers = await listCustomers(db);
  return Response.json({ customers });
}

export async function createCustomerRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await createCustomer(db, session, {
    name: body.name,
    phone: body.phone ?? null,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }
  return Response.json({ customer: result.value });
}

// Owner-only, per proposal.md's role list — see listStaffMembers.
export async function staffRoute(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const result = await listStaffMembers(db, session);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }
  const locations = await listLocations(db);
  return Response.json({ staff: result.value, locations });
}

export async function createStaffMemberRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await createStaffMember(db, session, {
    name: body.name,
    phone: body.phone,
    role: body.role,
    locationId: body.locationId,
    pin: body.pin,
    dailyRateMinor: body.dailyRateMinor,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }
  return Response.json({ staff: result.value });
}

export async function updateStaffMemberRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const result = await updateStaffMember(db, session, id, {
    name: body.name,
    phone: body.phone,
    role: body.role,
    locationId: body.locationId,
    dailyRateMinor: body.dailyRateMinor,
    pin: body.pin === "" || body.pin == null ? undefined : body.pin,
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }
  return Response.json({ staff: result.value });
}

// Owner-only, per proposal.md's role list — see listStaffMembers.
export async function daysWorkedRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const [daysResult, payResult] = await Promise.all([
    listDaysWorkedForStaff(db, session, id),
    getPayForStaff(db, session, id),
  ]);
  if (!daysResult.ok) {
    return Response.json({ error: daysResult.reason }, { status: writeStatus(daysResult.reason) });
  }
  if (!payResult.ok) {
    return Response.json({ error: payResult.reason }, { status: writeStatus(payResult.reason) });
  }
  return Response.json({ daysWorked: daysResult.value, pay: payResult.value });
}

export async function recordDaysWorkedRoute(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json();
  const result = await recordDaysWorked(db, session, {
    staffMemberId: body.staffMemberId,
    date: new Date(body.date),
  });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }
  return Response.json({ daysWorked: result.value });
}

export async function setStaffMemberActiveRoute(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const result = body.active
    ? await reactivateStaffMember(db, session, id)
    : await deactivateStaffMember(db, session, id);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: writeStatus(result.reason) });
  }
  return Response.json({ staff: result.value });
}

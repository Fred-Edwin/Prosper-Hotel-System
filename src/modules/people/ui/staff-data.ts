"use client";

/**
 * Fetch layer for the Staff tab. One GET populates both the staff list and
 * the location picker the create/edit form needs — same shape as
 * catalogue-data.ts.
 */

import type { Location, StaffMember } from "../schema";

export type StaffState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "denied" }
  | { status: "ready"; staff: StaffMember[]; locations: Location[] };

export async function fetchStaff(): Promise<StaffState> {
  try {
    const response = await fetch("/api/people/staff");
    if (response.status === 403) return { status: "denied" };
    if (!response.ok) return { status: "error" };
    const body = await response.json();
    if (!Array.isArray(body?.staff) || !Array.isArray(body?.locations)) {
      return { status: "error" };
    }
    return { status: "ready", staff: body.staff, locations: body.locations };
  } catch {
    return { status: "error" };
  }
}

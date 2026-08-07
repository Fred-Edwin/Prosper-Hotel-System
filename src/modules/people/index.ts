// Staff, days worked, pay, access, customers. See docs/architecture.md.

export { canAccessLocation, hashPin, login, logout } from "./logic";
export type { LoginResult, AuthenticatedStaff } from "./logic";
export { loginRoute, logoutRoute, getSession } from "./routes";
export {
  listActiveStaffAtLocation,
  findLocationByCode,
  findLocationById,
} from "./queries";
export type { StaffMember, Location, StaffRole, LocationCode } from "./schema";

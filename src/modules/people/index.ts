// Staff, days worked, pay, access, customers. See docs/architecture.md.

export {
  canAccessLocation,
  createCustomer,
  createStaffMember,
  deactivateStaffMember,
  findCustomerById,
  hashPin,
  listCustomers,
  listStaffMembers,
  login,
  logout,
  reactivateStaffMember,
  updateCustomer,
  updateStaffMember,
} from "./logic";
export type { LoginResult, AuthenticatedStaff } from "./logic";
export {
  loginRoute,
  logoutRoute,
  getSession,
  listCustomersRoute,
  createCustomerRoute,
  staffRoute,
  createStaffMemberRoute,
  updateStaffMemberRoute,
  setStaffMemberActiveRoute,
} from "./routes";
export {
  listActiveStaffAtLocation,
  findLocationByCode,
  findLocationById,
  listLocations,
  findStaffMembersByIds,
} from "./queries";
export type { StaffMember, Location, StaffRole, LocationCode, Customer } from "./schema";

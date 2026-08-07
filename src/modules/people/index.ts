// Staff, days worked, pay, access, customers. See docs/architecture.md.

export {
  canAccessLocation,
  createCustomer,
  findCustomerById,
  hashPin,
  listCustomers,
  login,
  logout,
  updateCustomer,
} from "./logic";
export type { LoginResult, AuthenticatedStaff } from "./logic";
export { loginRoute, logoutRoute, getSession } from "./routes";
export {
  listActiveStaffAtLocation,
  findLocationByCode,
  findLocationById,
} from "./queries";
export type { StaffMember, Location, StaffRole, LocationCode, Customer } from "./schema";

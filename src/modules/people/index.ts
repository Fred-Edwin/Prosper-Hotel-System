// Staff, days worked, pay, access, customers. See docs/architecture.md.

export {
  canAccessLocation,
  createCustomer,
  createStaffMember,
  deactivateStaffMember,
  findCustomerById,
  getPayForStaff,
  hashPin,
  listCustomers,
  listDaysWorkedForStaff,
  listStaffMembers,
  login,
  logout,
  markDaysWorkedPaid,
  reactivateStaffMember,
  recordDaysWorked,
  updateCustomer,
  updateStaffMember,
  getDaysWorkedForActivity,
} from "./logic";
export type { LoginResult, AuthenticatedStaff, PayForStaff } from "./logic";
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
  daysWorkedRoute,
  recordDaysWorkedRoute,
} from "./routes";
export {
  listActiveStaffAtLocation,
  findLocationByCode,
  findLocationById,
  listLocations,
  findStaffMembersByIds,
} from "./queries";
export type { StaffMember, Location, StaffRole, LocationCode, Customer, DaysWorked } from "./schema";

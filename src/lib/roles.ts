// Who can see and change what (Sammy, 10/10/2026). Owner and Manager logins
// are management and see everything. Everyone else (role Staff, Coach…)
// sees the day-to-day screens only and can't change settings or messages.
// Shared by the browser (to hide things) and the server (to refuse them).

export const isManagerRole = (role?: string | null) => /owner|manager/i.test(role ?? "");

/** Screens only management can open. */
export const MANAGEMENT_PATHS = ["/mailouts", "/automations", "/reports", "/forms", "/ads", "/champ/knowledge", "/staff"];
export const isManagementPath = (path: string) => MANAGEMENT_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

/** Changes only management can make: what gets sent to customers, and settings. */
export const MANAGEMENT_ACTIONS = new Set(["toggleAutomation", "setEmailStep", "updateForm", "setAvailability", "shiftClock"]);

export const ROLES = ["Owner", "Manager", "Staff"] as const;

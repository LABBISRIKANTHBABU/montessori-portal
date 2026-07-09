/**
 * Frontend smoke test - TypeScript compilation check.
 * Validates that App and API modules export correct types.
 * Runs via `tsc --noEmit` (no runtime test framework required).
 */

import App from "./App";
import { api, token } from "./api";
import { orderVisibleSchools, VISIBLE_SCHOOL_CODES } from "./schools/visibleSchools";

// Compile-time type checks (verified by tsc --noEmit)
type Assert<T extends true> = T;
type IsFunction<T> = T extends (...args: any[]) => any ? true : false;

type AppIsFunction = Assert<IsFunction<typeof App>>;
type ApiLoginExists = Assert<IsFunction<typeof api.login>>;
type ApiLogoutExists = Assert<IsFunction<typeof api.logout>>;
type ApiSchoolsExists = Assert<IsFunction<typeof api.schools>>;
type ApiDashboardExists = Assert<IsFunction<typeof api.dashboard>>;
type ApiSearchExists = Assert<IsFunction<typeof api.search>>;
type TokenSetExists = Assert<IsFunction<typeof token.set>>;
type TokenClearExists = Assert<IsFunction<typeof token.clear>>;

// Runtime smoke: module loads and exports are functions
export const appIsComponent = typeof App === "function";
export const apiLoginExists = typeof api.login === "function";
export const apiLogoutExists = typeof api.logout === "function";
export const apiSchoolsExists = typeof api.schools === "function";
export const apiDashboardExists = typeof api.dashboard === "function";
export const apiSearchExists = typeof api.search === "function";
export const tokenSetExists = typeof token.set === "function";
export const tokenClearExists = typeof token.clear === "function";

export const visibleSchoolCodesLocked = VISIBLE_SCHOOL_CODES.join(",");
export const visibleSchoolFilteringSmoke = orderVisibleSchools([
  { id: 9, code: "MIH", name: "Montessori Invictus, Hyderabad", city: "Hyderabad" },
  { id: 3, code: "MSSSACK", name: "Montessori Senior Secondary School, A-Camp, Kurnool", city: "Kurnool" },
  { id: 1, code: "MEMHSVNK", name: "Montessori EM High School, Vidya Nagar, Kurnool", city: "Kurnool" },
  { id: 8, code: "SSKH", name: "Sproutz School, Khanamit, Hyderabad", city: "Hyderabad" },
]).map(school => school.code).join(",");

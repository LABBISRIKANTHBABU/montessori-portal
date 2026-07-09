export const VISIBLE_SCHOOL_CODES = [
  "MEMHSVNK",
  "MSSSACK",
  "MHSA",
  "MIRSNHK",
  "MEMHSP",
  "MISNHK",
] as const;

const visibleSchoolCodeSet = new Set<string>(VISIBLE_SCHOOL_CODES);

export function isFrontendVisibleSchoolCode(code: string | null | undefined) {
  return visibleSchoolCodeSet.has(String(code || "").trim().toUpperCase());
}

export function visibleSchoolOrderSql(alias = "s") {
  return `FIELD(${alias}.legacy_code, ${VISIBLE_SCHOOL_CODES.map(() => "?").join(", ")})`;
}

export function visibleSchoolCodeParams() {
  return [...VISIBLE_SCHOOL_CODES];
}

import type { GroupOverview, GroupSchoolMetrics, School } from "../api";

export const VISIBLE_SCHOOL_CODES = [
  "MEMHSVNK",
  "MSSSACK",
  "MHSA",
  "MIRSNHK",
  "MEMHSP",
  "MISNHK",
] as const;

const visibleSchoolOrder = new Map<string, number>(
  VISIBLE_SCHOOL_CODES.map((code, index) => [code, index])
);

export function isFrontendVisibleSchool(school: Pick<School, "code">) {
  return visibleSchoolOrder.has(String(school.code || "").trim().toUpperCase());
}

export function orderVisibleSchools<T extends Pick<School, "code">>(schools: T[]) {
  return schools
    .filter(isFrontendVisibleSchool)
    .sort((left, right) => {
      const leftOrder = visibleSchoolOrder.get(String(left.code).trim().toUpperCase()) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = visibleSchoolOrder.get(String(right.code).trim().toUpperCase()) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });
}

export function filterVisibleGroupOverview(data: GroupOverview): GroupOverview {
  const schools = orderVisibleSchools<GroupSchoolMetrics>(data.schools);
  return {
    schools,
    totals: schools.reduce((totals, school) => ({
      schools: totals.schools + 1,
      students: totals.students + school.students,
      activeStudents: totals.activeStudents + school.activeStudents,
      events: totals.events + school.events,
      fees: totals.fees + school.fees,
      certificates: totals.certificates + school.certificates,
      staff: totals.staff + school.staff,
    }), { schools: 0, students: 0, activeStudents: 0, events: 0, fees: 0, certificates: 0, staff: 0 }),
  };
}

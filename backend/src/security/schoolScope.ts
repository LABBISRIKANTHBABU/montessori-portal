type SchoolScopeInput = {
  role: string;
  homeSchoolId: number;
  requestedSchoolId?: string;
  schoolExists: (schoolId: number) => Promise<boolean>;
};

export async function resolveSchoolScope(input: SchoolScopeInput): Promise<number> {
  if (input.requestedSchoolId === undefined) return input.homeSchoolId;
  const requestedSchoolId = Number(input.requestedSchoolId);
  if (!Number.isInteger(requestedSchoolId) || requestedSchoolId <= 0) {
    throw Object.assign(new Error("Select a valid school."), { statusCode: 422 });
  }
  if (input.role !== "group_super_admin" && requestedSchoolId !== input.homeSchoolId) {
    throw Object.assign(new Error("School administrators may access only their assigned school."), { statusCode: 403 });
  }
  if (input.role === "group_super_admin" && !(await input.schoolExists(requestedSchoolId))) {
    throw Object.assign(new Error("School not found."), { statusCode: 404 });
  }
  return requestedSchoolId;
}

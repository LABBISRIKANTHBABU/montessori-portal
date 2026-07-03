import { NextFunction, Response } from "express";
import type { AuthRequest } from "../types/auth.js";

/**
 * Role-to-permissions mapping.
 * Keys MUST match the role_code stored in JWT payload.role.
 * Permissions are checked on every request via requirePermission middleware.
 */
export const rolePermissions: Record<string, string[]> = {
  group_super_admin: [
    "dashboard.view",
    "student.view", "student.create", "student.update", "student.status.change",
    "student.document.upload", "student.identifier.view_sensitive", "student.export",
    "academic.manage", "user.manage",
    "account.view", "account.manage", "account.audit",
    "event.view", "event.manage",
    "certificate.view", "certificate.generate",
    "report.view", "report.financial",
    "settings.view", "settings.manage",
    "import.view", "import.upload", "import.approve", "import.legacy.stage",
  ],
  school_admin: [
    "dashboard.view",
    "student.view", "student.create", "student.update", "student.status.change",
    "student.document.upload", "student.export",
    "academic.manage", "user.manage",
    "account.view", "account.manage", "account.audit",
    "event.view", "event.manage",
    "certificate.view", "certificate.generate",
    "report.view", "report.financial",
    "settings.view", "settings.manage",
    "import.view", "import.upload", "import.approve", "import.legacy.stage",
  ],
  principal: [
    "dashboard.view",
    "student.view", "student.status.change", "student.export",
    "account.view",
    "event.view", "event.manage",
    "certificate.view", "certificate.generate",
    "report.view", "report.financial",
    "settings.view",
    "import.view",
  ],
  office_staff: [
    "dashboard.view",
    "student.view", "student.create", "student.update",
    "student.document.upload",
    "account.view",
    "event.view",
    "certificate.view",
    "report.view",
    "import.view", "import.upload",
  ],
  teacher: [
    "dashboard.view",
    "student.view",
    "event.view",
    "report.view",
  ],
  accountant: [
    "dashboard.view",
    "student.view",
    "account.view", "account.manage", "account.audit",
    "report.view", "report.financial",
  ],
  auditor: [
    "dashboard.view",
    "student.view", "student.export",
    "account.view",
    "report.view", "report.financial",
    "settings.view",
  ],
};

export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth?.permissions.includes(permission)) return res.status(403).json({ message: "You do not have permission to perform this action." });
    next();
  };
}

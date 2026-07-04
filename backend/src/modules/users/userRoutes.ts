/**
 * Module 9: User Management
 * Roles, permissions, users, school assignments.
 * All mutations verify school membership before executing.
 */

import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getPool, query } from "../../database/pool.js";
import { requirePermission, rolePermissions } from "../../security/permissions.js";
import type { AuthRequest } from "../../types/auth.js";
import type { RowDataPacket } from "mysql2/promise";

const router = Router();

const ROLE_NAMES: Record<string, string> = {
  group_super_admin: "Group Super Admin", school_admin: "School Admin", principal: "Principal",
  office_staff: "Office Staff", teacher: "Teacher", accountant: "Accountant", auditor: "Auditor",
};

// Helper: verify a user belongs to the requesting user's school
async function verifySchoolMembership(schoolId: number, userId: number): Promise<boolean> {
  const [rows] = await query(
    "SELECT 1 FROM v2_user_school_roles WHERE user_id = ? AND school_id = ? LIMIT 1",
    [userId, schoolId]
  );
  return Boolean(rows[0]);
}

async function isProtectedGroupAdministrator(schoolId: number, userId: number): Promise<boolean> {
  const [rows] = await query(
    "SELECT 1 FROM v2_user_school_roles WHERE user_id = ? AND school_id = ? AND role_code = 'group_super_admin' LIMIT 1",
    [userId, schoolId]
  );
  return Boolean(rows[0]);
}

async function mayManageUser(req: AuthRequest, targetUserId: number, res: any): Promise<boolean> {
  if (!(await verifySchoolMembership(req.auth!.schoolId, targetUserId))) {
    res.status(404).json({ message: "User not found in this school." });
    return false;
  }
  if (req.auth!.role !== "group_super_admin" && await isProtectedGroupAdministrator(req.auth!.schoolId, targetUserId)) {
    res.status(403).json({ message: "School administrators cannot manage Group Super Admin accounts." });
    return false;
  }
  return true;
}

// List users for a school
router.get("/", requirePermission("user.manage"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      `SELECT u.id, u.name, u.email, u.is_active active, usr.role_code roleCode,
              u.last_login_at lastLoginAt, u.created_at createdAt
       FROM v2_users u JOIN v2_user_school_roles usr ON usr.user_id = u.id
       WHERE usr.school_id = ? ORDER BY u.name`,
      [req.auth!.schoolId]
    );
    res.json({ data: rows.map(r => ({ ...r, roleName: ROLE_NAMES[r.roleCode] || r.roleCode })) });
  } catch (error) { next(error); }
});

// List roles available to the current administrator.
router.get("/roles/list", requirePermission("user.manage"), async (req: AuthRequest, res) => {
  const roles = Object.entries(ROLE_NAMES)
    .filter(([code]) => req.auth!.role === "group_super_admin" || code !== "group_super_admin")
    .map(([code, name]) => ({ code, name, permissions: rolePermissions[code] || [] }));
  res.json({ data: roles });
});

// Get single user
router.get("/:id", requirePermission("user.manage"), async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await query(
      `SELECT u.id, u.name, u.email, u.is_active active,
              usr.role_code roleCode, u.last_login_at lastLoginAt, u.created_at createdAt
       FROM v2_users u JOIN v2_user_school_roles usr ON usr.user_id = u.id
       WHERE u.id = ? AND usr.school_id = ?`,
      [req.params.id, req.auth!.schoolId]
    );
    if (!rows[0]) return res.status(404).json({ message: "User not found." });
    res.json({ data: { ...rows[0], roleName: ROLE_NAMES[rows[0].roleCode] || rows[0].roleCode } });
  } catch (error) { next(error); }
});

// Create user
router.post("/", requirePermission("user.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    name: z.string().min(2).max(150), email: z.email(),
    password: z.string(), roleCode: z.string().min(1)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide name, email, password, and role." });
  if (parsed.data.roleCode === "group_super_admin" && req.auth!.role !== "group_super_admin") {
    return res.status(403).json({ message: "Only a Group Super Admin can create another Group Super Admin." });
  }
  if (!rolePermissions[parsed.data.roleCode]) return res.status(422).json({ message: "Select a valid role." });
  try {
    // Check duplicate email
    const [existing] = await query(
      "SELECT id FROM v2_users WHERE LOWER(email) = LOWER(?)", [parsed.data.email]
    );
    if (existing[0]) return res.status(409).json({ message: "A user with this email already exists." });

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const [result] = await query(
      "INSERT INTO v2_users (name, email, password_hash, force_password_reset) VALUES (?, ?, ?, 0)",
      [parsed.data.name, parsed.data.email, passwordHash]
    );
    const userId = (result as any).insertId;

    await query(
      "INSERT INTO v2_user_school_roles (user_id, school_id, role_code) VALUES (?, ?, ?)",
      [userId, req.auth!.schoolId, parsed.data.roleCode]
    );

    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name)
       VALUES (?, ?, 'user', ?, 'user.create')`,
      [req.auth!.schoolId, req.auth!.userId, userId]
    );

    res.status(201).json({ data: { id: userId, message: "User created successfully." } });
  } catch (error) { next(error); }
});

// Update user
router.put("/:id", requirePermission("user.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({ name: z.string().min(2).max(150), roleCode: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide name and role." });
  if (parsed.data.roleCode === "group_super_admin" && req.auth!.role !== "group_super_admin") {
    return res.status(403).json({ message: "Only a Group Super Admin can grant the Group Super Admin role." });
  }
  if (!rolePermissions[parsed.data.roleCode]) return res.status(422).json({ message: "Select a valid role." });
  try {
    const targetUserId = Number(req.params.id);
    if (!(await mayManageUser(req, targetUserId, res))) return;

    await query("UPDATE v2_users SET name = ? WHERE id = ?", [parsed.data.name, targetUserId]);
    await query("UPDATE v2_user_school_roles SET role_code = ? WHERE user_id = ? AND school_id = ?",
      [parsed.data.roleCode, targetUserId, req.auth!.schoolId]);
    res.json({ data: { message: "User updated." } });
  } catch (error) { next(error); }
});

// Deactivate user
router.patch("/:id/deactivate", requirePermission("user.manage"), async (req: AuthRequest, res, next) => {
  try {
    const targetUserId = Number(req.params.id);
    if (!(await mayManageUser(req, targetUserId, res))) return;

    await query("UPDATE v2_users SET is_active = 0 WHERE id = ?", [targetUserId]);
    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'user', ?, 'user.deactivate', JSON_OBJECT('target_user', ?))`,
      [req.auth!.schoolId, req.auth!.userId, targetUserId, targetUserId]
    );
    res.json({ data: { message: "User deactivated." } });
  } catch (error) { next(error); }
});

// Activate user
router.patch("/:id/activate", requirePermission("user.manage"), async (req: AuthRequest, res, next) => {
  try {
    const targetUserId = Number(req.params.id);
    if (!(await mayManageUser(req, targetUserId, res))) return;

    await query("UPDATE v2_users SET is_active = 1 WHERE id = ?", [targetUserId]);
    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'user', ?, 'user.activate', JSON_OBJECT('target_user', ?))`,
      [req.auth!.schoolId, req.auth!.userId, targetUserId, targetUserId]
    );
    res.json({ data: { message: "User activated." } });
  } catch (error) { next(error); }
});

// Reset password
router.post("/:id/reset-password", requirePermission("user.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({ newPassword: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide a new password." });
  try {
    const targetUserId = Number(req.params.id);
    if (!(await mayManageUser(req, targetUserId, res))) return;

    const hash = await bcrypt.hash(parsed.data.newPassword, 12);
    await query("UPDATE v2_users SET password_hash = ?, force_password_reset = 0 WHERE id = ?", [hash, targetUserId]);
    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'user', ?, 'user.reset_password', JSON_OBJECT('target_user', ?))`,
      [req.auth!.schoolId, req.auth!.userId, targetUserId, targetUserId]
    );
    res.json({ data: { message: "Password reset successfully." } });
  } catch (error) { next(error); }
});

// Delete user (soft-delete by deactivating + removing school assignment)
router.delete("/:id", requirePermission("user.manage"), async (req: AuthRequest, res, next) => {
  try {
    const targetUserId = Number(req.params.id);
    if (targetUserId === req.auth!.userId) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }
    if (!(await mayManageUser(req, targetUserId, res))) return;

    await query("UPDATE v2_users SET is_active = 0 WHERE id = ?", [targetUserId]);
    await query(
      "DELETE FROM v2_user_school_roles WHERE user_id = ? AND school_id = ?",
      [targetUserId, req.auth!.schoolId]
    );
    await query(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'user', ?, 'user.delete', JSON_OBJECT('target_user', ?))`,
      [req.auth!.schoolId, req.auth!.userId, targetUserId, targetUserId]
    );
    res.json({ data: { message: "User deleted." } });
  } catch (error) { next(error); }
});

export default router;

/**
 * Module 7: Events
 * Event scheduling, participation, attendance, media archive, dashboard, archive, folders, budgets.
 * All data access goes through repository.ts for centralized DEMO_MODE switching.
 */

import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { extname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { z } from "zod";
import { requirePermission } from "../../security/permissions.js";
import type { AuthRequest } from "../../types/auth.js";
import {
  listEvents, getEvent, createEvent, updateEvent, updateEventStatus,
  addEventParticipants, removeEventParticipant, updateEventAttendance, uploadEventMedia,
  getEventsDashboard, getEventsArchive, deleteEvent,
  getEventMedia, deleteEventMedia as deleteEventMediaRepo,
  listEventFolders, createEventFolder, deleteEventFolder,
  listEventBudgets, createEventBudget, deleteEventBudget,
  getEventReports,
} from "../../repository.js";
import { resolveStoragePath, fileExists } from "../../storage/storageService.js";

const router = Router();
const mediaDir = resolve(process.cwd(), "../uploads/events");
mkdirSync(mediaDir, { recursive: true });

const mediaStorage = multer.diskStorage({
  destination: (_req, file, cb) => cb(null, mediaDir),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`)
});
const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 25 * 1024 * 1024, files: 50 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/quicktime", "application/pdf"]);
    if (!allowed.has(file.mimetype)) return cb(new Error("File type not allowed."));
    cb(null, true);
  }
});

// ─── Events Dashboard ───────────────────────────────────────────────────

router.get("/dashboard", requirePermission("event.view"), async (req: AuthRequest, res, next) => {
  try {
    const data = await getEventsDashboard(req.auth!.schoolId);
    res.json({ data });
  } catch (error) { next(error); }
});

// ─── Event Reports ─────────────────────────────────────────────────────

router.get("/reports", requirePermission("event.view"), async (req: AuthRequest, res, next) => {
  try {
    const data = await getEventReports(req.auth!.schoolId);
    res.json({ data });
  } catch (error) { next(error); }
});

// ─── Events Archive ──────────────────────────────────────────────────────

router.get("/archive", requirePermission("event.view"), async (req: AuthRequest, res, next) => {
  const year = String(req.query.year || "").trim() || undefined;
  try {
    const data = await getEventsArchive(req.auth!.schoolId, year);
    res.json({ data });
  } catch (error) { next(error); }
});

// ─── List events ─────────────────────────────────────────────────────────

router.get("/", requirePermission("event.view"), async (req: AuthRequest, res, next) => {
  const type = String(req.query.type || "").trim() || undefined;
  const status = String(req.query.status || "").trim() || undefined;
  try {
    const data = await listEvents(req.auth!.schoolId, type, status);
    res.json({ data });
  } catch (error) { next(error); }
});

// ─── Get single event ────────────────────────────────────────────────────

router.get("/:id", requirePermission("event.view"), async (req: AuthRequest, res, next) => {
  try {
    const data = await getEvent(req.auth!.schoolId, Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Event not found." });
    res.json({ data });
  } catch (error) { next(error); }
});

// ─── Create event ────────────────────────────────────────────────────────

router.post("/", requirePermission("event.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    title: z.string().min(1).max(200), description: z.string().optional(),
    eventType: z.enum(["cultural", "sports", "academic", "general", "holiday", "other"]),
    startDate: z.string(), endDate: z.string().optional(),
    location: z.string().max(200).optional(),
    academicYear: z.string().max(20).optional(), budget: z.number().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide event title and date." });
  try {
    const id = await createEvent(req.auth!.schoolId, req.auth!.userId, parsed.data);
    res.status(201).json({ data: { id, message: "Event created." } });
  } catch (error) { next(error); }
});

// ─── Update event details ────────────────────────────────────────────────

router.put("/:id", requirePermission("event.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    eventType: z.enum(["cultural", "sports", "academic", "general", "holiday", "other"]).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    location: z.string().max(200).optional(),
    academicYear: z.string().max(20).optional(),
    budget: z.number().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Invalid fields." });
  try {
    await updateEvent(req.auth!.schoolId, Number(req.params.id), parsed.data);
    res.json({ data: { message: "Event updated." } });
  } catch (error) { next(error); }
});

// ─── Update event status ─────────────────────────────────────────────────

router.patch("/:id/status", requirePermission("event.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({ status: z.enum(["draft", "published", "ongoing", "completed", "cancelled"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Invalid status." });
  try {
    await updateEventStatus(req.auth!.schoolId, Number(req.params.id), parsed.data.status);
    res.json({ data: { message: "Status updated." } });
  } catch (error) { next(error); }
});

// ─── Delete event ────────────────────────────────────────────────────────

router.delete("/:id", requirePermission("event.manage"), async (req: AuthRequest, res, next) => {
  try {
    await deleteEvent(req.auth!.schoolId, Number(req.params.id));
    res.json({ data: { message: "Event deleted." } });
  } catch (error) { next(error); }
});

// ─── Add participants ────────────────────────────────────────────────────

router.post("/:id/participants", requirePermission("event.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({ studentIds: z.array(z.number().int()).min(1), role: z.string().max(50).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Select at least one student." });
  try {
    await addEventParticipants(req.auth!.schoolId, Number(req.params.id), parsed.data.studentIds, parsed.data.role);
    res.json({ data: { message: `${parsed.data.studentIds.length} participant(s) added.` } });
  } catch (error) { next(error); }
});

// ─── Remove participant ──────────────────────────────────────────────────

router.delete("/:id/participants/:studentId", requirePermission("event.manage"), async (req: AuthRequest, res, next) => {
  try {
    const removed = await removeEventParticipant(req.auth!.schoolId, Number(req.params.id), Number(req.params.studentId));
    if (!removed) return res.status(404).json({ message: "Participant not found." });
    res.json({ data: { message: "Participant removed." } });
  } catch (error) { next(error); }
});

// ─── Update attendance ───────────────────────────────────────────────────

router.patch("/:id/attendance", requirePermission("event.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({ records: z.array(z.object({ participantId: z.number().int(), attendance: z.enum(["present", "absent", "late", "excused"]) })) }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide attendance records." });
  try {
    await updateEventAttendance(req.auth!.schoolId, Number(req.params.id), parsed.data.records);
    res.json({ data: { message: "Attendance updated." } });
  } catch (error) { next(error); }
});

// ─── Upload media ────────────────────────────────────────────────────────

router.post("/:id/media", requirePermission("event.manage"), mediaUpload.array("files", 50), async (req: AuthRequest, res, next) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) return res.status(422).json({ message: "Select files to upload." });
  const mediaType = String(req.body.mediaType || "photo");
  try {
    const count = await uploadEventMedia(req.auth!.schoolId, Number(req.params.id), req.auth!.userId, files, mediaType, req.body.caption);
    res.status(201).json({ data: { count, message: `${count} file(s) uploaded.` } });
  } catch (error) { next(error); }
});

// ─── Download media ──────────────────────────────────────────────────────

router.get("/media/:id/download", requirePermission("event.view"), async (req: AuthRequest, res, next) => {
  try {
    const media = await getEventMedia(req.auth!.schoolId, Number(req.params.id));
    if (!media) return res.status(404).json({ message: "Media not found." });
    const physicalPath = resolveStoragePath(media.storagePath);
    if (!fileExists(physicalPath)) return res.status(404).json({ message: "File not found on disk." });
    res.download(physicalPath, media.filename);
  } catch (error) { next(error); }
});

// ─── Delete media ────────────────────────────────────────────────────────

router.delete("/media/:id", requirePermission("event.manage"), async (req: AuthRequest, res, next) => {
  try {
    const media = await getEventMedia(req.auth!.schoolId, Number(req.params.id));
    if (media) {
      const physicalPath = resolveStoragePath(media.storagePath);
      if (fileExists(physicalPath)) {
        const { unlinkSync } = await import("node:fs");
        unlinkSync(physicalPath);
      }
    }
    await deleteEventMediaRepo(req.auth!.schoolId, Number(req.params.id));
    res.json({ data: { message: "Media deleted." } });
  } catch (error) { next(error); }
});

// ─── Folders ─────────────────────────────────────────────────────────────

router.get("/:id/folders", requirePermission("event.view"), async (req: AuthRequest, res, next) => {
  try {
    const data = await listEventFolders(req.auth!.schoolId, Number(req.params.id));
    res.json({ data });
  } catch (error) { next(error); }
});

router.post("/:id/folders", requirePermission("event.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    name: z.string().min(1).max(100),
    folderType: z.enum(["photos", "videos", "documents", "invitations", "reports", "certificates", "budget", "other"]),
    parentId: z.number().int().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide folder name and type." });
  try {
    const id = await createEventFolder(req.auth!.schoolId, Number(req.params.id), parsed.data.name, parsed.data.folderType, parsed.data.parentId);
    res.status(201).json({ data: { id, message: "Folder created." } });
  } catch (error) { next(error); }
});

router.delete("/folders/:folderId", requirePermission("event.manage"), async (req: AuthRequest, res, next) => {
  try {
    await deleteEventFolder(req.auth!.schoolId, Number(req.params.folderId));
    res.json({ data: { message: "Folder deleted." } });
  } catch (error) { next(error); }
});

// ─── Budgets ─────────────────────────────────────────────────────────────

router.get("/:id/budgets", requirePermission("event.view"), async (req: AuthRequest, res, next) => {
  try {
    const data = await listEventBudgets(req.auth!.schoolId, Number(req.params.id));
    res.json({ data });
  } catch (error) { next(error); }
});

router.post("/:id/budgets", requirePermission("event.manage"), async (req: AuthRequest, res, next) => {
  const parsed = z.object({
    category: z.string().min(1).max(100),
    description: z.string().max(255).optional(),
    amount: z.number().min(0),
    expenseType: z.enum(["planned", "actual"]),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "Provide category and amount." });
  try {
    const id = await createEventBudget(req.auth!.schoolId, Number(req.params.id), req.auth!.userId, parsed.data);
    res.status(201).json({ data: { id, message: "Budget item added." } });
  } catch (error) { next(error); }
});

router.delete("/budgets/:budgetId", requirePermission("event.manage"), async (req: AuthRequest, res, next) => {
  try {
    await deleteEventBudget(req.auth!.schoolId, Number(req.params.budgetId));
    res.json({ data: { message: "Budget item deleted." } });
  } catch (error) { next(error); }
});

export default router;

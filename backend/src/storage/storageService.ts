/**
 * Storage Abstraction Layer
 * 
 * All file storage goes through this module. Raw paths are NEVER exposed
 * outside this boundary. The module handles:
 * - Organized folder structure: {root}/{schoolId}/{module}/{year?}/{subpath}
 * - UUID-based filenames to prevent collisions
 * - Path obfuscation (storage keys vs physical paths)
 * - Cleanup on failed uploads
 */

import { randomUUID } from "node:crypto";
import { extname, join, relative } from "node:path";
import { mkdirSync, unlinkSync, existsSync, statSync, readdirSync } from "node:fs";

export type StorageModule = "documents" | "students" | "events" | "settings" | "imports";

export interface StoredFile {
  /** Physical path on disk (only used internally) */
  physicalPath: string;
  /** Logical storage key (never exposes raw path structure) */
  storageKey: string;
  /** Original filename from user */
  originalFilename: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
}

const ROOT = process.env.UPLOAD_ROOT || join(process.cwd(), "uploads");

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

function sanitizeSegment(value: string): string {
  return String(value || "unknown")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 100);
}

/**
 * Get the root storage path for a school module.
 * Structure: {root}/{schoolId}/{module}/
 */
function getModuleRoot(schoolId: number, module: StorageModule): string {
  const dir = join(ROOT, String(schoolId), module);
  ensureDir(dir);
  return dir;
}

/**
 * Generate an organized path for a document.
 * Structure: {root}/{schoolId}/documents/{year?}/{category}/
 */
function getDocumentDir(schoolId: number, categoryCode: string, academicYear?: string): string {
  const base = join(ROOT, String(schoolId), "documents");
  if (academicYear) {
    return join(base, sanitizeSegment(academicYear), sanitizeSegment(categoryCode));
  }
  return join(base, sanitizeSegment(categoryCode));
}

/**
 * Store a file with organized path structure.
 * Returns a StoredFile with both physical path and logical key.
 */
export function storeFile(
  schoolId: number,
  module: StorageModule,
  file: { originalname: string; mimetype: string; size: number; buffer?: Buffer; path?: string },
  options: { academicYear?: string; categoryCode?: string; subpath?: string } = {}
): StoredFile {
  const ext = extname(file.originalname).toLowerCase();
  const uuid = randomUUID();
  const filename = `${uuid}${ext}`;

  let dir: string;
  if (module === "documents" && options.categoryCode) {
    dir = getDocumentDir(schoolId, options.categoryCode, options.academicYear);
  } else if (options.subpath) {
    dir = join(getModuleRoot(schoolId, module), sanitizeSegment(options.subpath));
  } else {
    dir = getModuleRoot(schoolId, module);
  }
  ensureDir(dir);

  const physicalPath = join(dir, filename);
  
  // If file is on disk (multer disk storage), move it
  if (file.path && existsSync(file.path) && file.path !== physicalPath) {
    const { renameSync } = require("node:fs") as typeof import("node:fs");
    renameSync(file.path, physicalPath);
  }

  // Build logical key (never expose full physical path)
  const storageKey = [schoolId, module, options.academicYear, options.categoryCode, filename]
    .filter(Boolean)
    .join("/");

  return {
    physicalPath,
    storageKey,
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  };
}

/**
 * Resolve a storage key back to a physical path.
 * This is the ONLY place that maps keys to disk paths.
 */
export function resolveStoragePath(storageKey: string): string {
  // For backward compatibility, if it's already a full path, return it
  if (storageKey.startsWith("/") || storageKey.match(/^[A-Z]:\\/i)) {
    return storageKey;
  }
  // Parse the key format: schoolId/module/.../filename
  return join(ROOT, ...storageKey.split("/"));
}

/**
 * Delete a file by storage key or physical path.
 */
export function deleteFile(pathOrKey: string): boolean {
  try {
    const physical = resolveStoragePath(pathOrKey);
    if (existsSync(physical)) {
      unlinkSync(physical);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if a file exists.
 */
export function fileExists(pathOrKey: string): boolean {
  try {
    const physical = resolveStoragePath(pathOrKey);
    return existsSync(physical) && statSync(physical).isFile();
  } catch {
    return false;
  }
}

/**
 * Get file info without exposing the path.
 */
export function getFileInfo(pathOrKey: string): { exists: boolean; size?: number; modified?: Date } {
  try {
    const physical = resolveStoragePath(pathOrKey);
    const stat = statSync(physical);
    return { exists: true, size: stat.size, modified: stat.mtime };
  } catch {
    return { exists: false };
  }
}

/**
 * List files in a directory (for admin/audit purposes).
 */
export function listFiles(pathOrKey: string): string[] {
  try {
    const physical = resolveStoragePath(pathOrKey);
    if (!existsSync(physical)) return [];
    return readdirSync(physical).filter(f => statSync(join(physical, f)).isFile());
  } catch {
    return [];
  }
}

/**
 * Get storage stats for a school (admin dashboard).
 */
export function getSchoolStorageStats(schoolId: number): { totalFiles: number; totalSizeBytes: number; modules: Record<string, { files: number; size: number }> } {
  const schoolDir = join(ROOT, String(schoolId));
  if (!existsSync(schoolDir)) return { totalFiles: 0, totalSizeBytes: 0, modules: {} };

  const modules: Record<string, { files: number; size: number }> = {};
  let totalFiles = 0;
  let totalSize = 0;

  for (const mod of readdirSync(schoolDir)) {
    const modPath = join(schoolDir, mod);
    if (!statSync(modPath).isDirectory()) continue;
    
    let files = 0;
    let size = 0;
    
    function walkDir(dir: string) {
      for (const entry of readdirSync(dir)) {
        const entryPath = join(dir, entry);
        const stat = statSync(entryPath);
        if (stat.isDirectory()) {
          walkDir(entryPath);
        } else {
          files++;
          size += stat.size;
        }
      }
    }
    walkDir(modPath);
    
    modules[mod] = { files, size };
    totalFiles += files;
    totalSize += size;
  }

  return { totalFiles, totalSizeBytes: totalSize, modules };
}

import type { Request } from "express";
export type AuthContext = { userId: number; schoolId: number; role: string; permissions: string[]; sessionId?: string };
export type AuthRequest = Request & { auth?: AuthContext };

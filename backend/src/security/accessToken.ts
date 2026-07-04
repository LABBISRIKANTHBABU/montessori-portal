import { JWTPayload, SignJWT, jwtVerify } from "jose";
import { getConfig } from "../config/env.js";

export const ACCESS_TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

function signingKey() {
  return new TextEncoder().encode(getConfig().JWT_SECRET);
}

export async function createAccessToken(input: {
  userId: number;
  schoolId: number;
  role: string;
  permissions: string[];
}) {
  return new SignJWT({
    schoolId: input.schoolId,
    role: input.role,
    permissions: input.permissions,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(input.userId))
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_LIFETIME_SECONDS}s`)
    .sign(signingKey());
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
  return payload;
}

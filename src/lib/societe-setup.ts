import { randomBytes } from "crypto";

/** Days a self-service access-code setup link stays valid before an admin must regenerate it. */
export const SETUP_TOKEN_TTL_DAYS = 7;

export function generateSetupToken(): string {
  return randomBytes(24).toString("hex");
}

export function setupTokenExpiryDate(): Date {
  return new Date(Date.now() + SETUP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isSetupTokenExpired(expiresAt: Date | null): boolean {
  return !expiresAt || expiresAt.getTime() < Date.now();
}

/** Never a real login secret — a client can never log in "by accident" before setting their own code. */
export function generatePlaceholderCodeAcces(): string {
  return `__pending__${randomBytes(16).toString("hex")}`;
}

export function buildSetupUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/client-setup/${token}`;
}

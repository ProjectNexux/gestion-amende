import { PrismaClient } from "@prisma/client";

const PRISMA_GLOBAL = Symbol.for("gestion-amende.prisma");

const globalForPrisma = globalThis as typeof globalThis & {
  [PRISMA_GLOBAL]?: PrismaClient;
};

export const prisma =
  globalForPrisma[PRISMA_GLOBAL] ??
  (globalForPrisma[PRISMA_GLOBAL] = new PrismaClient({
    log: ["error", "warn"],
  }));

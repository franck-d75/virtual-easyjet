import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis;
export function createPrismaClient() {
    return new PrismaClient();
}
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
export { PrismaClient };
//# sourceMappingURL=client.js.map
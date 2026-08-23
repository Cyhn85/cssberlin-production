import { PrismaClient } from '@/generated/prisma';

const prismaClientSingleton = () => {
    return new PrismaClient({
        // Never leaves the server. The product routes query with `include`,
        // which serialises every scalar on the model, so an internal column is
        // public the day it is added. reservedById names the user currently in
        // checkout for an item - that is other people's shopping behaviour.
        // Queries that need it read it through `where`, which omit does not
        // touch.
        omit: {
            product: { reservedById: true },
        },
    });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

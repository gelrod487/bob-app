const { PrismaClient } = require('@prisma/client');

// Standard singleton pattern so hot-reload / serverless cold starts don't open
// a new connection pool on every request.
const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

module.exports = prisma;

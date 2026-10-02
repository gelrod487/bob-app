// Run before any local Prisma command: loads the dev env file and exits non-zero unless it
// points at the dev project. Used by `npm run dev:migrate`.
require('dotenv').config({ path: process.env.BOB_ENV_FILE || '.env.dev' });
require('../src/lib/devGuard').assertDevEnv();

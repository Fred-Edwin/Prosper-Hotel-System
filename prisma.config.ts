import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Lets `pnpm test:migrate` point migrate deploy at the test database
    // without a second config file — see docs/gotchas.md's Prisma
    // migrations section.
    url:
      process.env["NODE_ENV"] === "test"
        ? process.env["TEST_DATABASE_URL"]
        : process.env["DATABASE_URL"],
  },
});

import { defineConfig, devices } from "@playwright/test";

// Defaults to 3000 so nothing changes for the common single-checkout case.
// Set PLAYWRIGHT_PORT when running e2e from a parallel git worktree, so its
// build/start doesn't collide with another worktree's server on the same
// port — see .claude/skills/build/SKILL.md's worktree step.
const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `PORT=${port} pnpm build && PORT=${port} pnpm start`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/staff.json",
      },
      dependencies: ["setup"],
    },
  ],
});

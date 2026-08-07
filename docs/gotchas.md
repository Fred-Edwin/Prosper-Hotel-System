# Gotchas

Non-obvious things that cost real time. Add to this file, don't rediscover.

## Docker / CI

- **Image tags must be lowercase.** `${{ github.repository_owner }}` in GitHub
  Actions resolves to the GitHub account's display casing (`Fred-Edwin`), and
  `docker buildx build --tag` rejects uppercase in image refs. Fixed by
  hardcoding `ghcr.io/fred-edwin/prosper-hotel` in the workflow's `env.IMAGE`
  instead of interpolating the raw context variable.
- **The Dockerfile's runner stage always does
  `COPY --from=builder /app/public ./public`.** If there's no `public/`
  directory (no static assets yet), the build fails outright. Fixed with an
  empty `public/.gitkeep`. Don't delete that directory without checking the
  Dockerfile still has something to copy.
- **Don't validate Docker builds locally in this sandbox.** `pnpm install`
  inside a `docker build` here hits registry timeouts and can take 5+ minutes
  then fail — a sandbox network limitation, not a real problem. GitHub
  Actions' runners build the same Dockerfile in ~3.5 minutes with no issue.
  Push and let CI build; don't try to reproduce it locally first.
- **The deploy workflow only ever pulled the app image — it never synced
  `docker-compose.prod.yml` or `Caddyfile` to the droplet.** Editing either
  file in the repo (e.g. adding an env var to the `app` service) silently had
  no effect in production, because the droplet kept running its own
  original copy indefinitely. Discovered when `SENTRY_DSN` was added to the
  compose file but never reached the running container. Fixed by adding an
  `scp` step (`appleboy/scp-action`) ahead of the SSH deploy step that syncs
  both files on every push to main. If a future compose/Caddyfile edit
  "does nothing" in prod, check whether the droplet's copy is stale before
  assuming the app code is wrong.
- **pnpm's build-script allowlist (`pnpm-workspace.yaml`'s `allowBuilds`)
  blocks postinstall scripts for new dependencies by default**, including
  `@sentry/cli`'s (needed for source map upload). `pnpm add` succeeds but
  the postinstall silently doesn't run — set the package to `true` in
  `allowBuilds` and re-run `pnpm install`.

## Droplet / SSH

- **The SSH key shown as selected in DigitalOcean's droplet-creation UI isn't
  self-evidently correct.** On this droplet, only one key was selectable
  (`wendo-rms-server`) and it didn't match the laptop's actual key. Diagnosed
  via DigitalOcean's Web Console (bypasses SSH entirely), fixed by manually
  appending the laptop's public key to `authorized_keys`. Verify by
  connecting — don't assume the UI's selection is right.
- **Don't co-locate unrelated clients' stacks on one droplet to save cost.**
  An existing droplet (`wendo-droplet`) already runs a live 4-container stack
  for a different client with only ~1GB of real headroom on a 2GB box. A
  fresh dedicated droplet was provisioned for Prosper Hotel instead, to avoid
  cross-client resource contention on someone else's production box.

## GitHub Actions auth

- **Pushing changes to `.github/workflows/*` requires the `workflow` OAuth
  scope on the local `gh` CLI**, which the default install doesn't have. The
  device-code flow (`gh auth refresh -s workflow`) is fragile under a tool
  with a short command timeout — it can get cut off mid-flow. The fix that
  actually worked: have the user run
  `gh auth login -h github.com -s workflow -w` directly in their own
  terminal, not proxied through a tool call.

# Agent Instructions

- Start every response with the wizard emoji "🧙" when working in this repo.
- Use pnpm.
- Do development directly on `main` unless the user explicitly asks for a branch.
- Never commit real secrets, `.dev.vars`, `.env`, production Cloudflare IDs, private owner data, or hosted subscription billing config.
- Keep ME3 Core, plugin-owned, and hosted-only boundaries explicit in code, docs, and examples.
- Run the narrow quality gate for the change. For web app work, run `pnpm build`.
- Verify git scope before staging so install-local or unrelated user work is not hidden or reverted.

## Ecosystem Source Of Truth

- Canonical high-level ecosystem docs live at `/Users/kieranbutler/Coding/docs`.
- Read `/Users/kieranbutler/Coding/docs/README.md` and `/Users/kieranbutler/Coding/docs/projects/me3-core.md` before strategic or cross-app work.
- Shared UI guidance lives at `/Users/kieranbutler/Coding/docs/design-system/README.md`.
- Durable architecture belongs in the shared docs. Actionable plans, acceptance criteria, and execution history belong in beads.

## Worker API Structure

- Keep `apps/worker/src/index.ts` as Worker composition/runtime wiring only: Hono app setup, global middleware, route registration, and Cloudflare `fetch`/`email`/`scheduled`/`queue` handlers.
- Do not add new feature routes or domain helper piles directly to `apps/worker/src/index.ts`. Add or extend a domain route module, for example `apps/worker/src/routes/<domain>.ts`, and keep business logic in a service module.
- If a route needs more than thin request parsing, auth checks, and response shaping, move that logic beside the owning service before wiring the route.
- When a domain adds several endpoints, register them through a `register<Domain>Routes(app, deps)` function so `index.ts` grows by one import and one registration call.

## Core Updates And Releases

- Core install repositories may intentionally merge upstream stable tags. Resolve conflicts, commit the merge, and push `main`; do not rebase a completed update merge unless the user explicitly asks.
- When creating a new upstream stable tag, update Core release metadata first:
  - `me3-core.json` must have the new installed Core `version`.
  - `updates/stable.json` must set `latest.version`, `latest.tag`, `releasedAt`, `releaseNotesUrl`, and add the release to the top of `releases`.
  - Set `migrationRequired: true` when the release includes Worker/D1 migrations since the previous stable release.
- Commit and push the metadata update on `main`, then create and push the tag from that commit.
- After tagging, verify with `pnpm update:check -- --manifest-url updates/stable.json --json`.

## Session Completion

When code changed:

1. Run the narrow quality gate for the change.
2. Verify git scope and avoid staging unrelated user work.
3. Commit completed work on `main` when the user asks you to land it.
4. Push `main` only when the work is ready to land:
   ```bash
   git status
   git pull --rebase
   bd sync
   git push origin main
   git status
   ```

For Core update merge commits in install repositories, skip `git pull --rebase` after the merge commit and push the verified merge directly.

**Critical rules:**

- `main` is the only branch to push by default.
- If push fails, resolve and retry until it succeeds.
- Never force-push `main`.
- Never run destructive cleanup commands unless the user explicitly asks.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const rootDir = path.resolve(import.meta.dirname, "..");
const workflow = readFileSync(path.join(rootDir, ".github/workflows/update-core.yml"), "utf8");
const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));

test("copied-repository updates migrate before push and deployment", () => {
  const update = getStep("Update ME3");
  const migrations = getStep("Apply database migrations");
  const push = getStep("Commit and push Core update");
  const deploy = getStep("Deploy to Cloudflare");

  assert.match(update, /wrangler\.toml merge=me3-install-ours/);
  assert.match(migrations, /pnpm db:migrations:apply/);
  assert.match(deploy, /wrangler deploy --config wrangler\.toml/);
  assert.doesNotMatch(`${migrations}\n${deploy}`, /deploy:prepare/);
  assert.ok(workflow.indexOf(migrations) < workflow.indexOf(push));
  assert.ok(workflow.indexOf(push) < workflow.indexOf(deploy));
  assert.doesNotMatch(migrations, /continue-on-error:\s*true/);

  const workersBuildDeploy = packageJson.scripts.deploy;
  assert.ok(
    workersBuildDeploy.indexOf("db:migrations:apply") <
      workersBuildDeploy.indexOf("wrangler deploy"),
  );
});

test("a failed migration stops the deployment gate", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "me3-update-workflow-"));
  const pnpm = path.join(directory, "pnpm");
  writeFileSync(pnpm, "#!/bin/sh\nexit 23\n");
  chmodSync(pnpm, 0o755);

  try {
    const result = spawnSync("bash", ["-c", getRunScript("Apply database migrations")], {
      cwd: rootDir,
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
      encoding: "utf8",
    });

    assert.equal(result.status, 23);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("an unchanged fresh copy builds and deploys when installation credentials exist", () => {
  const build = getStep("Build current release for deployment");
  assert.match(build, /changed != 'true'/);
  assert.match(build, /pnpm install --frozen-lockfile/);
  assert.match(build, /pnpm build/);
  for (const name of ["Apply database migrations", "Deploy to Cloudflare"]) {
    const step = getStep(name);
    const condition = step.match(/if: (.*)/)?.[1];
    assert.equal(condition, "env.CLOUDFLARE_ACCOUNT_ID != '' && env.CLOUDFLARE_API_TOKEN != ''");
    assert.ok(workflow.indexOf(build) < workflow.indexOf(step));
  }
  // An update-only run may never install packages, so setup-node must not try
  // saving a pnpm store that does not exist during post-job cleanup.
  assert.doesNotMatch(getStep("Setup Node.js"), /cache: pnpm/);
});

function getStep(name) {
  const start = workflow.indexOf(`      - name: ${name}\n`);
  assert.notEqual(start, -1, `Missing workflow step: ${name}`);
  const end = workflow.indexOf("\n      - name: ", start + 1);
  return workflow.slice(start, end === -1 ? undefined : end);
}

function getRunScript(name) {
  const marker = "        run: |\n";
  const block = getStep(name);
  const start = block.indexOf(marker);
  assert.notEqual(start, -1, `Missing run script: ${name}`);
  return block
    .slice(start + marker.length)
    .split("\n")
    .map((line) => line.replace(/^ {10}/, ""))
    .join("\n");
}

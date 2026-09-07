import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { verifyManagedUpgradeRelease } from "./verify-managed-upgrade-release.mjs";

test("pins a stable tag to its immutable commit and matching Core metadata", () => {
  const directory = mkdtempSync(join(tmpdir(), "me3-upgrade-release-"));
  const metadataPath = join(directory, "me3-core.json");
  writeFileSync(
    metadataPath,
    JSON.stringify({
      schemaVersion: 1,
      version: "0.1.109",
      releaseChannel: "stable",
      releaseNotesUrl:
        "https://github.com/soulinkfoundation/me3-core/releases/tag/v0.1.109",
    }),
  );
  const sha = "a".repeat(40);
  try {
    assert.deepEqual(
      verifyManagedUpgradeRelease({
        metadataPath,
        targetReleaseTag: "v0.1.109",
        targetReleaseSha: sha,
        actualReleaseSha: sha,
      }),
      { tag: "v0.1.109", version: "0.1.109", commitSha: sha },
    );
    for (const change of [
      { actualReleaseSha: "b".repeat(40) },
      { targetReleaseTag: "v0.1.108" },
    ]) {
      assert.throws(
        () =>
          verifyManagedUpgradeRelease({
            metadataPath,
            targetReleaseTag: "v0.1.109",
            targetReleaseSha: sha,
            actualReleaseSha: sha,
            ...change,
          }),
        /release metadata is invalid/,
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

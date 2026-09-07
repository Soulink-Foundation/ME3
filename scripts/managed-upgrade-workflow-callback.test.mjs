import assert from "node:assert/strict";
import test from "node:test";
import { MANAGED_UPGRADE_CALLBACK_URL } from "./managed-upgrade-contract.mjs";
import { sendManagedUpgradeWorkflowCallback } from "./managed-upgrade-workflow-callback.mjs";

const installationId = "mi-1234567890abcdef";
const workerName = `me3-${installationId}`;
const env = {
  ME3_MANAGED_CALLBACK_URL: MANAGED_UPGRADE_CALLBACK_URL,
  ME3_MANAGED_UPGRADE_CALLBACK_SECRET: "upgrade-callback-secret",
  GITHUB_RUN_ID: "123456789",
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "soulinkfoundation/me3-core",
  ME3_MANAGED_ATTEMPT_ID: "11111111-1111-4111-8111-111111111111",
  ME3_MANAGED_INSTALLATION_ID: installationId,
  ME3_MANAGED_CURRENT_RELEASE_TAG: "v0.1.108",
  ME3_MANAGED_TARGET_RELEASE_TAG: "v0.1.109",
  ME3_MANAGED_TARGET_RELEASE_SHA: "a".repeat(40),
  WORKER_NAME: workerName,
  D1_NAME: `${workerName}-d1`,
  D1_ID: "22222222-2222-4222-8222-222222222222",
  R2_NAME: `${workerName}-r2`,
  QUEUE_NAMES: JSON.stringify([
    `${workerName}-social-publish`,
    `${workerName}-social-publish-dlq`,
  ]),
  DO_NAMESPACE_ID: "b".repeat(32),
  PUBLIC_ORIGIN: "https://owner.me3.app",
  ME3_MANAGED_CANONICAL_HOSTNAME: "owner.me3.app",
  ME3_MANAGED_ZONE_ID: "c".repeat(32),
};

test("reports attempt-correlated progress without claiming completion", async () => {
  let payload;
  await sendManagedUpgradeWorkflowCallback(
    {
      ...env,
      ME3_MANAGED_STATUS: "running",
      ME3_MANAGED_STAGE: "migrating",
    },
    async (url, init) => {
      assert.equal(url, MANAGED_UPGRADE_CALLBACK_URL);
      assert.equal(
        new Headers(init.headers).get("Authorization"),
        "Bearer upgrade-callback-secret",
      );
      payload = JSON.parse(init.body);
      return new Response(null, { status: 204 });
    },
  );

  assert.equal(payload.attemptId, env.ME3_MANAGED_ATTEMPT_ID);
  assert.equal(payload.currentReleaseTag, "v0.1.108");
  assert.equal(payload.targetReleaseTag, "v0.1.109");
  assert.equal(payload.workflowRunId, "123456789");
  assert.equal(
    payload.workflowUrl,
    "https://github.com/soulinkfoundation/me3-core/actions/runs/123456789",
  );
  assert.equal(Object.hasOwn(payload, "observedReleaseTag"), false);
  assert.equal(Object.hasOwn(payload, "resourceManifest"), false);
});

test("success attests the live target and unchanged complete resource manifest", async () => {
  let payload;
  await sendManagedUpgradeWorkflowCallback(
    {
      ...env,
      ME3_MANAGED_STATUS: "succeeded",
      ME3_MANAGED_STAGE: "completed",
    },
    async (_url, init) => {
      payload = JSON.parse(init.body);
      return new Response(null, { status: 204 });
    },
  );

  assert.equal(payload.observedReleaseTag, "v0.1.109");
  assert.equal(payload.observedVersion, "0.1.109");
  assert.equal(payload.observedReleaseSha, "a".repeat(40));
  assert.deepEqual(payload.resourceManifest, {
    workerName,
    d1Name: `${workerName}-d1`,
    d1Id: env.D1_ID,
    r2Name: `${workerName}-r2`,
    queueNames: JSON.parse(env.QUEUE_NAMES).sort(),
    durableObjectNamespaceId: env.DO_NAMESPACE_ID,
    publicOrigin: env.PUBLIC_ORIGIN,
    canonicalHostname: env.ME3_MANAGED_CANONICAL_HOSTNAME,
    zoneId: env.ME3_MANAGED_ZONE_ID,
  });
  assert.match(payload.resourceManifestSha256, /^[0-9a-f]{64}$/);
});

test("only completed can succeed and every failure is generic", async () => {
  const request = async () => new Response(null, { status: 204 });
  await assert.rejects(
    sendManagedUpgradeWorkflowCallback(
      {
        ...env,
        ME3_MANAGED_STATUS: "succeeded",
        ME3_MANAGED_STAGE: "verifying",
      },
      request,
    ),
    /configuration is invalid/,
  );
  await assert.rejects(
    sendManagedUpgradeWorkflowCallback(
      {
        ...env,
        ME3_MANAGED_STATUS: "failed",
        ME3_MANAGED_STAGE: "deploying",
        ME3_MANAGED_ERROR_CODE: "deployment_log_leaked",
      },
      request,
    ),
    /configuration is invalid/,
  );
  await sendManagedUpgradeWorkflowCallback(
    {
      ...env,
      ME3_MANAGED_STATUS: "failed",
      ME3_MANAGED_STAGE: "deploying",
      ME3_MANAGED_ERROR_CODE: "workflow_failed",
    },
    request,
  );
});

test("a rejected callback does not expose its body or secret", async () => {
  await assert.rejects(
    sendManagedUpgradeWorkflowCallback(
      {
        ...env,
        ME3_MANAGED_STATUS: "running",
        ME3_MANAGED_STAGE: "validating",
      },
      async () =>
        new Response(JSON.stringify({ privateReason: "stale attempt" }), {
          status: 409,
        }),
    ),
    (error) => {
      assert.equal(error.message, "managed upgrade callback returned 409");
      assert.doesNotMatch(error.message, /stale attempt|upgrade-callback-secret/);
      return true;
    },
  );
});

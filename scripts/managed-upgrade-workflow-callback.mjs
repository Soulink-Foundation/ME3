#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import {
  hashManagedUpgradeResourceManifest,
  managedUpgradeContractFromEnv,
  managedUpgradeResourceManifest,
} from "./managed-upgrade-contract.mjs";

const STATUSES = new Set(["running", "succeeded", "failed"]);
const STAGES = new Set([
  "validating",
  "checking_current",
  "preparing",
  "building",
  "migrating",
  "deploying",
  "verifying",
  "completed",
]);
const ERROR_CODES = new Set(["workflow_failed"]);

export async function sendManagedUpgradeWorkflowCallback(
  env = process.env,
  request = globalThis.fetch,
) {
  const contract = managedUpgradeContractFromEnv(env);
  const secret = env.ME3_MANAGED_UPGRADE_CALLBACK_SECRET?.trim();
  const status = env.ME3_MANAGED_STATUS?.trim();
  const stage = env.ME3_MANAGED_STAGE?.trim();
  const errorCode = env.ME3_MANAGED_ERROR_CODE?.trim();
  const workflowRunId = env.GITHUB_RUN_ID?.trim();
  const workflowServerUrl = env.GITHUB_SERVER_URL?.trim();
  const workflowRepository = env.GITHUB_REPOSITORY?.trim();
  const workflowUrl = `${workflowServerUrl}/${workflowRepository}/actions/runs/${workflowRunId}`;

  if (
    !secret ||
    !/^[1-9][0-9]{0,19}$/.test(workflowRunId || "") ||
    workflowServerUrl !== "https://github.com" ||
    workflowRepository !== "soulinkfoundation/me3-core" ||
    !STATUSES.has(status) ||
    !STAGES.has(stage) ||
    (errorCode && !ERROR_CODES.has(errorCode)) ||
    (status === "running" && (stage === "completed" || errorCode)) ||
    (status === "succeeded" && (stage !== "completed" || errorCode)) ||
    (status === "failed" && (stage === "completed" || errorCode !== "workflow_failed"))
  ) {
    throw new Error("managed upgrade callback configuration is invalid");
  }

  const succeeded = status === "succeeded";
  const response = await request(contract.callbackUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      installationId: contract.installationId,
      attemptId: contract.attemptId,
      currentReleaseTag: contract.currentReleaseTag,
      targetReleaseTag: contract.targetReleaseTag,
      targetReleaseSha: contract.targetReleaseSha,
      workflowRunId,
      workflowUrl,
      status,
      stage,
      ...(errorCode ? { errorCode } : {}),
      ...(succeeded
        ? {
            observedReleaseTag: contract.targetReleaseTag,
            observedVersion: contract.targetReleaseTag.slice(1),
            observedReleaseSha: contract.targetReleaseSha,
            resourceManifest: managedUpgradeResourceManifest(contract),
            resourceManifestSha256:
              hashManagedUpgradeResourceManifest(contract),
          }
        : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`managed upgrade callback returned ${response.status}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await sendManagedUpgradeWorkflowCallback();
}

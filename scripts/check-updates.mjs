#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreMetadataPath = path.join(rootDir, "me3-core.json");
const packageJsonPath = path.join(rootDir, "package.json");
const defaultManifestUrl =
  "https://raw.githubusercontent.com/soulinkfoundation/me3-core/main/updates/stable.json";

const args = parseArgs(process.argv.slice(2));
const coreMetadata = await loadInstalledCoreMetadata();
const installedVersion = normalizeVersion(coreMetadata.version);
const manifestUrl =
  args.manifestUrl ||
  process.env.ME3_UPDATE_MANIFEST_URL ||
  coreMetadata.updateManifestUrl ||
  defaultManifestUrl;

try {
  const manifest = await loadManifest(manifestUrl);
  const latest = manifest.latest || {};
  const latestVersion = normalizeVersion(latest.version || "");
  const comparison = compareVersions(installedVersion, latestVersion);
  const updateAvailable = comparison < 0;
  const result = {
    installedVersion,
    channel: manifest.channel || "stable",
    latestVersion,
    latestTag: latest.tag || (latestVersion ? `v${latestVersion}` : ""),
    updateAvailable,
    migrationRequired: latest.migrationRequired === true,
    breaking: latest.breaking === true,
    releaseNotesUrl: latest.releaseNotesUrl || "",
    manifestUrl,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHumanResult(result);
  }
} catch (error) {
  if (args.json) {
    console.log(
      JSON.stringify(
        {
          installedVersion,
          manifestUrl,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
  } else {
    console.error(
      `Could not check for ME3 updates: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error(`Manifest: ${manifestUrl}`);
  }
  process.exitCode = 1;
}

function parseArgs(values) {
  const parsed = {
    json: false,
    manifestUrl: "",
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--") {
      continue;
    } else if (value === "--json") {
      parsed.json = true;
    } else if (value === "--manifest-url") {
      parsed.manifestUrl = values[index + 1] || "";
      index += 1;
    } else if (value.startsWith("--manifest-url=")) {
      parsed.manifestUrl = value.slice("--manifest-url=".length);
    } else {
      fail(`Unknown option: ${value}`);
    }
  }

  return parsed;
}

async function loadManifest(source) {
  if (!/^https?:\/\//i.test(source)) {
    const manifestPath = path.resolve(rootDir, source);
    return JSON.parse(await readFile(manifestPath, "utf8"));
  }

  return fetchManifest(source);
}

async function loadInstalledCoreMetadata() {
  try {
    return JSON.parse(await readFile(coreMetadataPath, "utf8"));
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    return {
      version: packageJson.version,
      updateManifestUrl: defaultManifestUrl,
    };
  }
}

async function fetchManifest(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": `me3-core-update-check/${installedVersion}`,
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const manifest = await response.json();
  if (!manifest || typeof manifest !== "object" || !manifest.latest) {
    throw new Error("Update manifest is missing a latest release entry");
  }
  return manifest;
}

function printHumanResult(result) {
  console.log(`ME3 installed: ${result.installedVersion}`);
  console.log(`ME3 latest ${result.channel}: ${result.latestVersion || "unknown"}`);

  if (!result.latestVersion) {
    console.log("Could not determine the latest stable version.");
    return;
  }

  if (!result.updateAvailable) {
    console.log("ME3 is up to date.");
    return;
  }

  console.log("");
  console.log(`Update available: ${result.latestTag || `v${result.latestVersion}`}`);
  if (result.migrationRequired) console.log("- D1 migrations are included in this update.");
  if (result.breaking) {
    console.log("- This update includes breaking changes. Read the release notes first.");
  }
  if (result.releaseNotesUrl) console.log(`Release notes: ${result.releaseNotesUrl}`);
  console.log("");
  console.log("MVP update path:");
  console.log("  pnpm update:core");
  console.log("  git push origin main");
}

function normalizeVersion(value) {
  return String(value || "").trim().replace(/^v/i, "");
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);

  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] !== b.parts[index]) return a.parts[index] - b.parts[index];
  }

  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

function parseVersion(value) {
  const [version, prerelease = ""] = normalizeVersion(value).split("-", 2);
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  return {
    parts: [parts[0] || 0, parts[1] || 0, parts[2] || 0],
    prerelease,
  };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type {
  ScriptDetail,
  ScriptDiscoveryWarning,
  ScriptManifest,
  ScriptMeta,
  ScriptRunner,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, "..");
export const SCRIPTS_DIR = path.join(ROOT_DIR, "scripts");
export const OUTPUT_DIR =
  process.env.SCRIPT_OUTPUT_ROOT ||
  (process.env.VERCEL ? path.join("/tmp", "automation-output") : path.join(ROOT_DIR, "output"));

const SCRIPT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const ENTRY_CANDIDATES = [
  "run.spec.ts",
  "index.spec.ts",
  "run.ts",
  "index.ts",
  "run.js",
  "index.js",
];

export function assertValidScriptId(id: string): void {
  if (!SCRIPT_ID_PATTERN.test(id)) {
    throw new Error("Invalid script id");
  }
}

export function getScriptDir(id: string): string {
  assertValidScriptId(id);
  const scriptDir = path.join(SCRIPTS_DIR, id);
  const resolved = path.resolve(scriptDir);
  if (!resolved.startsWith(path.resolve(SCRIPTS_DIR) + path.sep)) {
    throw new Error("Invalid script path");
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`Script not found: ${id}`);
  }
  return resolved;
}

function inferRunner(entry: string): ScriptRunner {
  return entry.endsWith(".spec.ts") ? "playwright" : "tsx";
}

function resolveEntry(scriptDir: string, manifest: ScriptManifest): string {
  if (manifest.entry) {
    const entryPath = path.join(scriptDir, manifest.entry);
    if (!fs.existsSync(entryPath)) {
      throw new Error(`Entry file not found: ${manifest.entry}`);
    }
    return manifest.entry;
  }

  for (const candidate of ENTRY_CANDIDATES) {
    if (fs.existsSync(path.join(scriptDir, candidate))) {
      return candidate;
    }
  }

  throw new Error("No entry file found. Add run.spec.ts, run.ts, or set entry in script.json");
}

function readManifest(scriptDir: string, id: string): ScriptMeta {
  const manifestPath = path.join(scriptDir, "script.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing script.json in scripts/${id}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as ScriptManifest;
  if (!manifest.name?.trim() || !manifest.description?.trim()) {
    throw new Error(`script.json for ${id} must include name and description`);
  }

  const entry = resolveEntry(scriptDir, manifest);
  const runner = manifest.runner ?? inferRunner(entry);

  return {
    id,
    name: manifest.name.trim(),
    description: manifest.description.trim(),
    category: manifest.category?.trim() || "Automation",
    icon: manifest.icon?.trim() || "terminal",
    runner,
    entry,
  };
}

export function discoverScripts(): ScriptMeta[] {
  return discoverScriptCatalog().scripts;
}

export function discoverScriptCatalog(): {
  scripts: ScriptMeta[];
  warnings: ScriptDiscoveryWarning[];
} {
  console.log("ROOT_DIR:", ROOT_DIR);
console.log("SCRIPTS_DIR:", SCRIPTS_DIR);
console.log("Exists:", fs.existsSync(SCRIPTS_DIR));

if (fs.existsSync(SCRIPTS_DIR)) {
  console.log("Contents:", fs.readdirSync(SCRIPTS_DIR));
}
  if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
    return { scripts: [], warnings: [] };
  }

  const warnings: ScriptDiscoveryWarning[] = [];
  const scripts = fs
    .readdirSync(SCRIPTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .map((id) => {
      if (!SCRIPT_ID_PATTERN.test(id)) {
        warnings.push({
          folder: id,
          message: "Folder names must use lowercase letters, numbers, and hyphens only.",
        });
        return null;
      }

      try {
        return readManifest(getScriptDir(id), id);
      } catch (error) {
        warnings.push({
          folder: id,
          message: error instanceof Error ? error.message : "Failed to load script.",
        });
        return null;
      }
    })
    .filter((script): script is ScriptMeta => script !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { scripts, warnings };
}

export function getScriptDetail(id: string): ScriptDetail {
  const scriptDir = getScriptDir(id);
  const meta = readManifest(scriptDir, id);
  const sourcePath = path.join(scriptDir, meta.entry);
  const source = fs.readFileSync(sourcePath, "utf-8");

  return {
    ...meta,
    source,
    sourceFile: meta.entry,
  };
}

export function createRunOutputDir(scriptId: string, runId: string): string {
  const outputDir = path.join(OUTPUT_DIR, scriptId, runId);
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

export function listRunArtifacts(scriptId: string, runId: string): string[] {
  const outputDir = path.join(OUTPUT_DIR, scriptId, runId);
  if (!fs.existsSync(outputDir)) {
    return [];
  }

  return fs.readdirSync(outputDir).filter((name) => {
    const filePath = path.join(outputDir, name);
    return fs.statSync(filePath).isFile();
  });
}

export function resolveArtifactPath(scriptId: string, runId: string, filename: string): string {
  assertValidScriptId(scriptId);
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    throw new Error("Invalid artifact filename");
  }

  const artifactPath = path.join(OUTPUT_DIR, scriptId, runId, filename);
  const resolved = path.resolve(artifactPath);
  const allowedRoot = path.resolve(OUTPUT_DIR, scriptId, runId);
  if (!resolved.startsWith(allowedRoot + path.sep) && resolved !== allowedRoot) {
    throw new Error("Invalid artifact path");
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error("Artifact not found");
  }
  return resolved;
}

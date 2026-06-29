import { spawn } from "child_process";
import path from "path";
import { randomUUID } from "crypto";
import {
  ROOT_DIR,
  createRunOutputDir,
  getScriptDetail,
  listRunArtifacts,
} from "./scripts.js";
import type { ArtifactInfo } from "./types.js";

const TSX_CLI = path.join(ROOT_DIR, "node_modules", "tsx", "dist", "cli.mjs");
const PLAYWRIGHT_CLI = path.join(ROOT_DIR, "node_modules", "@playwright", "test", "cli.js");

export interface RunCallbacks {
  onLog: (message: string) => void;
}

export interface RunResult {
  runId: string;
  success: boolean;
  exitCode: number | null;
  artifacts: ArtifactInfo[];
  error?: string;
}

function mimeTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".json":
      return "application/json";
    case ".txt":
      return "text/plain";
    case ".html":
      return "text/html";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

function buildArtifactUrls(scriptId: string, runId: string, files: string[]): ArtifactInfo[] {
  return files.map((name) => ({
    name,
    url: `/api/artifacts/${scriptId}/${runId}/${encodeURIComponent(name)}`,
    mimeType: mimeTypeFor(name),
  }));
}

function runProcess(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
  callbacks: RunCallbacks
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const forward = (chunk: Buffer, prefix: string) => {
      const text = chunk.toString();
      text
        .split(/\r?\n/)
        .filter((line) => line.length > 0)
        .forEach((line) => callbacks.onLog(`${prefix}${line}`));
    };

    child.stdout.on("data", (chunk) => forward(chunk, ""));
    child.stderr.on("data", (chunk) => forward(chunk, "[stderr] "));

    child.on("error", reject);
    child.on("close", (code) => resolve(code));
  });
}

export async function runScript(scriptId: string, callbacks: RunCallbacks): Promise<RunResult> {
  const script = getScriptDetail(scriptId);
  const runId = randomUUID();
  const outputDir = createRunOutputDir(scriptId, runId);
  const scriptDir = path.join(ROOT_DIR, "scripts", scriptId);
  const entryPath = path.resolve(scriptDir, script.entry);
  const playwrightTestArg = path.posix.join(scriptId, script.entry.replace(/\\/g, "/"));

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SCRIPT_OUTPUT_DIR: outputDir,
    SCRIPT_ID: scriptId,
    SCRIPT_RUN_ID: runId,
  };

  callbacks.onLog(`[runner] Starting ${script.name} (${script.runner})`);
  callbacks.onLog(`[runner] Entry: scripts/${scriptId}/${script.entry}`);
  callbacks.onLog(`[runner] Output: output/${scriptId}/${runId}`);

  let exitCode: number | null = null;

  try {
    if (script.runner === "playwright") {
      exitCode = await runProcess(
        process.execPath,
        [
          PLAYWRIGHT_CLI,
          "test",
          playwrightTestArg,
          "--config",
          path.join(ROOT_DIR, "playwright.config.ts"),
        ],
        { cwd: ROOT_DIR, env },
        callbacks
      );
    } else {
      exitCode = await runProcess(
        process.execPath,
        [TSX_CLI, entryPath],
        { cwd: ROOT_DIR, env },
        callbacks
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    callbacks.onLog(`[runner] Failed to start process: ${message}`);
    return {
      runId,
      success: false,
      exitCode: null,
      artifacts: [],
      error: message,
    };
  }

  const artifactFiles = listRunArtifacts(scriptId, runId);
  const artifacts = buildArtifactUrls(scriptId, runId, artifactFiles);
  const success = exitCode === 0;

  if (success) {
    callbacks.onLog(`[runner] Completed successfully (${artifactFiles.length} artifact(s))`);
  } else {
    callbacks.onLog(`[runner] Exited with code ${exitCode ?? "unknown"}`);
  }

  return {
    runId,
    success,
    exitCode,
    artifacts,
    error: success ? undefined : `Process exited with code ${exitCode ?? "unknown"}`,
  };
}

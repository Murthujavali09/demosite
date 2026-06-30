import "../server/env.js";
import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import { runScript } from "../server/runner.js";
import { resolveArtifactPath } from "../server/scripts.js";

interface ApiRequest extends IncomingMessage {
  body?: unknown;
}

async function readJsonBody(req: ApiRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object") {
    return req.body as Record<string, unknown>;
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body) as Record<string, unknown>;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf-8").trim();
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

export default async function handler(req: ApiRequest, res: ServerResponse) {
  if (req.method !== "POST") {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let scriptId = "";
  try {
    const body = await readJsonBody(req);
    scriptId = typeof body.scriptId === "string" ? body.scriptId : "";
  } catch {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  if (!scriptId) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Missing scriptId" }));
    return;
  }

  try {
    const result = await runScript(scriptId, {
      onLog: (message) => console.log(message),
    });

    if (!result.success) {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 500;
      res.end(JSON.stringify({ error: result.error || "Script execution failed" }));
      return;
    }

    const artifact = result.artifacts[0];
    if (!artifact) {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Script completed without generating a file" }));
      return;
    }

    const artifactPath = resolveArtifactPath(scriptId, result.runId, artifact.name);
    res.setHeader("Content-Type", artifact.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${artifact.name.replace(/"/g, "")}"`
    );
    fs.createReadStream(artifactPath).pipe(res);
  } catch (error) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Script execution failed",
      })
    );
  }
}

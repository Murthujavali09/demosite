import "../server/env.js";
import fs from "fs";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";
import { resolveArtifactPath } from "../server/scripts.js";

interface ApiRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
}

function queryValue(req: ApiRequest, name: string): string | undefined {
  const value = req.query?.[name];
  if (Array.isArray(value)) return value[0];
  if (value) return value;

  const url = new URL(req.url || "", "http://localhost");
  return url.searchParams.get(name) || undefined;
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

export default function handler(req: ApiRequest, res: ServerResponse) {
  if (req.method !== "GET") {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const scriptId = queryValue(req, "scriptId");
  const runId = queryValue(req, "runId");
  const filename = queryValue(req, "filename");

  if (!scriptId || !runId || !filename) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Missing artifact parameters" }));
    return;
  }

  try {
    const artifactPath = resolveArtifactPath(scriptId, runId, filename);
    res.setHeader("Content-Type", mimeTypeFor(filename));
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    fs.createReadStream(artifactPath).pipe(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Artifact not found";
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 404;
    res.end(JSON.stringify({ error: message }));
  }
}

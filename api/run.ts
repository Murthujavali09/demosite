import "../server/env.js";
import type { IncomingMessage, ServerResponse } from "http";
import { runScript } from "../server/runner.js";

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

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");

  const writeEvent = (payload: Record<string, unknown>) => {
    res.write(`${JSON.stringify(payload)}\n`);
  };

  try {
    const result = await runScript(scriptId, {
      onLog: (message) => writeEvent({ type: "log", message }),
    });

    writeEvent({
      type: "complete",
      success: result.success,
      runId: result.runId,
      artifacts: result.artifacts,
      error: result.error,
    });
  } catch (error) {
    writeEvent({
      type: "complete",
      success: false,
      runId: null,
      artifacts: [],
      error: error instanceof Error ? error.message : "Script execution failed",
    });
  }

  res.end();
}

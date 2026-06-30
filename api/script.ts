import "../server/env.js";
import type { IncomingMessage, ServerResponse } from "http";
import { getScriptDetail } from "../server/scripts.js";

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

export default function handler(req: ApiRequest, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const id = queryValue(req, "id");
  if (!id) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Missing script id" }));
    return;
  }

  try {
    res.end(JSON.stringify(getScriptDetail(id)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load script";
    res.statusCode = message.includes("not found") ? 404 : 400;
    res.end(JSON.stringify({ error: message }));
  }
}

import "../server/env.js";
import type { IncomingMessage, ServerResponse } from "http";
import { discoverScriptCatalog } from "../server/scripts.js";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    res.end(JSON.stringify(discoverScriptCatalog()));
  } catch (error) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to list scripts",
      })
    );
  }
}

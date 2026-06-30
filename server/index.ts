import "./env.js";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import {
  OUTPUT_DIR,
  discoverScriptCatalog,
  getScriptDetail,
  resolveArtifactPath,
} from "./scripts.js";
import { runScript } from "./runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.API_PORT || 3001);

const app = express();
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});
app.use(express.json());
app.get("/api/test", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/test/abc", (_req, res) => {
  res.json({ route: "nested works" });
});
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/scripts", (_req, res) => {
  try {
    res.json(discoverScriptCatalog());
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list scripts",
    });
  }
});

app.get("/api/scripts/:id", (req, res) => {
  try {
    res.json(getScriptDetail(req.params.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load script";
    res.status(message.includes("not found") ? 404 : 400).json({ error: message });
  }
});

app.post("/api/scripts/:id/run", async (req, res) => {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const writeEvent = (payload: Record<string, unknown>) => {
    res.write(`${JSON.stringify(payload)}\n`);
  };

  try {
    const result = await runScript(req.params.id, {
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
});

app.get("/api/artifacts/:scriptId/:runId/:filename", (req, res) => {
  try {
    const artifactPath = resolveArtifactPath(
      req.params.scriptId,
      req.params.runId,
      req.params.filename
    );
    res.sendFile(artifactPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Artifact not found";
    res.status(404).json({ error: message });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`Automation API listening on http://localhost:${PORT}`);
    console.log(`Scripts directory: ${path.join(__dirname, "..", "scripts")}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
  });
}

export default app;

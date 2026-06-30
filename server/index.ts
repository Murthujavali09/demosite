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
app.use(express.json());
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

app.get("/api/script", (req, res) => {
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) {
    res.status(400).json({ error: "Missing script id" });
    return;
  }

  try {
    res.json(getScriptDetail(id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load script";
    res.status(message.includes("not found") ? 404 : 400).json({ error: message });
  }
});

app.post("/api/run", async (req, res) => {
  const scriptId = typeof req.body?.scriptId === "string" ? req.body.scriptId : "";
  if (!scriptId) {
    res.status(400).json({ error: "Missing scriptId" });
    return;
  }

  try {
    const result = await runScript(scriptId, {
      onLog: (message) => console.log(message),
    });

    if (!result.success) {
      res.status(500).json({ error: result.error || "Script execution failed" });
      return;
    }

    const artifact = result.artifacts[0];
    if (!artifact) {
      res.status(404).json({ error: "Script completed without generating a file" });
      return;
    }

    const artifactPath = resolveArtifactPath(scriptId, result.runId, artifact.name);
    res.type(artifact.mimeType);
    res.download(artifactPath, artifact.name);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Script execution failed",
    });
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

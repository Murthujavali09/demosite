export interface ScriptMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  runner: "playwright" | "tsx";
  entry: string;
}

export interface ScriptDetail extends ScriptMeta {
  source: string;
  sourceFile: string;
}

export interface ScriptDiscoveryWarning {
  folder: string;
  message: string;
}

export interface ScriptsResponse {
  scripts: ScriptMeta[];
  warnings?: ScriptDiscoveryWarning[];
}

export interface ArtifactInfo {
  name: string;
  url: string;
  mimeType: string;
}

export interface RunCompleteEvent {
  type: "complete";
  success: boolean;
  runId: string | null;
  artifacts: ArtifactInfo[];
  error?: string;
}

type StreamEvent =
  | { type: "log"; message: string }
  | RunCompleteEvent;

async function parseError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.error || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function fetchScripts(): Promise<ScriptsResponse> {
  const response = await fetch("/api/scripts");
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function fetchScriptDetail(id: string): Promise<ScriptDetail> {
  const response = await fetch(`/api/script?id=${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function runScript(
  id: string,
  handlers: {
    onLog: (message: string) => void;
    onComplete: (result: RunCompleteEvent) => void;
  }
): Promise<void> {
  const response = await fetch("/api/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scriptId: id }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  if (!response.body) {
    throw new Error("No response stream from server");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as StreamEvent;
      if (event.type === "log") {
        handlers.onLog(event.message);
      } else if (event.type === "complete") {
        handlers.onComplete(event);
      }
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer) as StreamEvent;
    if (event.type === "log") {
      handlers.onLog(event.message);
    } else if (event.type === "complete") {
      handlers.onComplete(event);
    }
  }
}

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

export interface ScriptDownload {
  blob: Blob;
  filename: string;
}

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

function filenameFromDisposition(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  return match?.[1] ? decodeURIComponent(match[1].replace(/"/g, "")) : fallback;
}

export async function runScript(id: string): Promise<ScriptDownload> {
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

  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get("Content-Disposition"), `${id}-output`),
  };
}

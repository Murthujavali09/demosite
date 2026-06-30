export type ScriptRunner = "playwright" | "tsx";

export interface ScriptMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  runner: ScriptRunner;
  entry: string;
}

export interface ScriptManifest {
  name: string;
  description: string;
  category?: string;
  icon?: string;
  runner?: ScriptRunner;
  entry?: string;
}

export interface ScriptDetail extends ScriptMeta {
  source: string;
  sourceFile: string;
}

export interface ArtifactInfo {
  name: string;
  mimeType: string;
}

export interface ScriptDiscoveryWarning {
  folder: string;
  message: string;
}

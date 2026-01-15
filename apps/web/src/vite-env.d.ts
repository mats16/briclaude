/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DATABRICKS_HOST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

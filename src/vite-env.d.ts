/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Address of the Spese push server (push-worker/), e.g. https://spese-push.<you>.workers.dev */
  readonly VITE_PUSH_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

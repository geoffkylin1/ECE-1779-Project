interface ImportMetaEnv {
  /** "true" to answer /api requests with the in-browser MSW mock. */
  readonly VITE_USE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css' {
  const text: string
  export default text
}

declare module '@deepseek-ai/cordis' {
  export interface Context {
    effect: (callback: () => () => void, label?: string) => void
    [key: string]: unknown
  }
}

interface Window {
  __ModuleLoader__?: { load: (record: { id: string; factory: (require: (id: string) => unknown) => unknown }) => void }
}

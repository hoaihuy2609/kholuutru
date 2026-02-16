/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string
    // thêm các biến môi trường khác nếu cần
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

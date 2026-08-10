/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_API_TARGET?: string;
  readonly VITE_WS_BASE_URL?: string;
  readonly VITE_MEDIA_BASE_URL?: string;
  readonly VITE_ENVIRONMENT?: string;
  readonly VITE_ENABLE_MOCK_API?: string;
  readonly VITE_ENABLE_PLATFORM_SANDBOX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

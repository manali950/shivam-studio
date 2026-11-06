/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'mock' | 'api';
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_BASE_DOMAIN?: string;
  readonly VITE_PLATFORM_HOSTS?: string;
  readonly VITE_DEFAULT_TENANT?: string;
  readonly VITE_DEV_TENANT_SWITCHER?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
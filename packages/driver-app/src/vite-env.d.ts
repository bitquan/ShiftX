/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ROUTING_PROVIDER?: 'google' | 'mapbox' | 'osrm' | 'none';
  readonly VITE_ROUTING_API_KEY?: string;
  readonly VITE_OSRM_BASE_URL?: string;
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    lang: import('@/i18n').Lang;
    user?: DrupalUser | null;
  }
}

interface DrupalUser {
  uid: string;
  name: string;
  mail?: string;
  roles: string[];
  session_name?: string;
  session_id?: string;
}

interface ImportMetaEnv {
  readonly NODEHIVE_BASE_URL: string;
  readonly NODEHIVE_API_KEY: string;
  readonly NODEHIVE_EDITOR_DEV_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    __NODEHIVE_BASE_URL__: string;
    __NODEHIVE_LANG__: string;
    __NODEHIVE_EDITOR__: {
      setLang: (lang: string) => void;
      isEditorActive: () => boolean;
    };
  }
}

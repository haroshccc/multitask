/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_FEATURE_GOOGLE_CALENDAR?: string;
  readonly VITE_FEATURE_GOOGLE_MEET?: string;
  readonly VITE_FEATURE_WHATSAPP?: string;
  readonly VITE_FEATURE_TRANSCRIPTION?: string;
  readonly VITE_FEATURE_AI_EXTRACTION?: string;
  readonly VITE_FEATURE_PUSH_NOTIFICATIONS?: string;
  readonly VITE_ONESIGNAL_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

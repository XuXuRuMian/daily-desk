/*
 * Optional cloud sync configuration.
 * Create a Supabase project and fill these two values to enable cross-device sync.
 * Keep this file free of service_role keys; the anon key is safe for browser use.
 */

// 配置对象
export const DAILY_DESK_CONFIG = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
};

// 向后兼容：也挂载到 window 对象
if (typeof window !== 'undefined') {
  window.DAILY_DESK_CONFIG = DAILY_DESK_CONFIG;
}

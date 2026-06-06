import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Sunucu tarafı Supabase istemcisi (service_role).
 * RLS'i bypass eder; erişim uygulama oturumu + requireSession ile sınırlanır.
 * Bu anahtar asla NEXT_PUBLIC_ veya tarayıcıya gönderilmemelidir.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL tanımlı değil.");
  }
  if (!key?.trim()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY tanımlı değil. Supabase Dashboard → Project Settings → API → service_role"
    );
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

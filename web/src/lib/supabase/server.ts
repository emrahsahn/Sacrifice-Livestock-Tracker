import { createAdminClient } from "@/lib/supabase/admin";

/** Tüm sunucu tarafı DB erişimi service_role üzerinden yapılır. */
export async function createClient() {
  return createAdminClient();
}

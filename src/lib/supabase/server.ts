/**
 * Supabase client para uso no SERVIDOR (API routes, Server Components, Inngest).
 * Usa a service_role key (bypassa RLS — seguro pra uso interno).
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let client: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createServerClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local"
    );
  }

  client = createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false },
  });

  return client;
}

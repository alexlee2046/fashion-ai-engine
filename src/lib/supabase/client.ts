import { createBrowserClient } from '@supabase/ssr';

// 环境变量验证
function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  return { url, key };
}

export function createClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient(url, key);
}

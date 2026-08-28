export type SupabaseHealth = { ok: boolean; status: number };

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("بيانات اتصال Supabase غير مهيأة.");
  return { url: url.replace(/\/$/, ""), key };
}

/**
 * فحص محدود للقراءة فقط على خدمة Auth.
 * لا يعرض المفتاح ولا ينشئ مستخدمين أو بيانات.
 */
export async function verifySupabaseConnection(fetchImpl: typeof fetch = fetch): Promise<SupabaseHealth> {
  const { url, key } = getSupabaseConfig();
  const response = await fetchImpl(`${url}/auth/v1/settings`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return { ok: response.ok, status: response.status };
}

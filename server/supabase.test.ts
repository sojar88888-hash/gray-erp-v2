import { describe, expect, it } from "vitest";
import { verifySupabaseConnection } from "./supabase";

describe("اتصال Supabase", () => {
  it("يتحقق من خدمة Auth بالمفتاح القابل للنشر دون تعديل بيانات", async () => {
    const result = await verifySupabaseConnection();
    expect(result).toEqual({ ok: true, status: 200 });
  }, 15_000);
});

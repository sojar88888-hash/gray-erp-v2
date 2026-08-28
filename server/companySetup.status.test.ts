import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("حالة تهيئة الشركة", () => {
  it("تعيد قيمة صريحة حتى قبل إنشاء شركة للمستخدم", async () => {
    const ctx = {
      user: { id: 999999, openId: "company-status-test", name: "Status Test", email: null, loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: { protocol: "https", headers: { origin: "https://erp.example.test", host: "erp.example.test" } },
      res: { clearCookie: () => undefined },
    } as unknown as TrpcContext;

    const result = await appRouter.createCaller(ctx).erp.setup.status();
    expect(result).not.toBeUndefined();
  });
});

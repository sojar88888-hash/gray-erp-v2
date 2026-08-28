import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function financialCaller(role: "admin" | "manager" | "accountant" | "user") {
  const ctx = {
    user: { id: 710, openId: "financial-gate-test", name: "Financial Gate Test", email: null, loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: { origin: "https://erp.example.test", host: "erp.example.test" } },
    res: { clearCookie: () => undefined },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

describe("إجراءات المالية المحكومة", () => {
  it("ترفض ترحيل قيد حتى لمدير النظام بينما بوابة الجاهزية محجوبة", async () => {
    await expect(financialCaller("admin").erp.financial.postJournalEntry({ journalEntryId: 1 })).rejects.toThrow("محجوبان");
  });

  it("ترفض إصدار قائمة مالية حتى لمدير النظام بينما بوابة الجاهزية محجوبة", async () => {
    await expect(financialCaller("admin").erp.financial.issueFinancialStatement({ statementType: "income_statement", periodCode: "2026-06" })).rejects.toThrow("محجوبان");
  });

  it("يرفض ترحيل القيد من دور لا يملك صلاحية الترحيل قبل فحص الجاهزية", async () => {
    await expect(financialCaller("accountant").erp.financial.postJournalEntry({ journalEntryId: 1 })).rejects.toThrow("صلاحية ترحيل");
  });
});

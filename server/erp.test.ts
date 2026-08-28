import { describe, expect, it } from "vitest";
import { hasPermission, validateCompanySetup, validateJournalLine, validateStockMovement } from "./erp";

describe("صلاحيات GRAY ERP", () => {
  it("تمنح مدير النظام صلاحية إدارة النظام", () => {
    expect(hasPermission("admin", "administration.manage")).toBe(true);
  });

  it("لا تمنح المستخدم العادي صلاحية إنشاء مستند مبيعات", () => {
    expect(hasPermission("user", "sales.create")).toBe(false);
  });
});

describe("ضوابط الحركات", () => {
  it("يرفض سطر القيد الذي يجمع مدينًا ودائنًا", () => {
    expect(() => validateJournalLine("100", "100")).toThrow("مدين أو دائن");
  });

  it("يرفض النقل من موقع إلى الموقع نفسه", () => {
    expect(() => validateStockMovement({ direction: "transfer", quantity: 25, fromLocationId: 8, toLocationId: 8 })).toThrow("مختلفين");
  });

  it("يقبل إدخال مخزون بكمية موجبة ووجهة محددة", () => {
    expect(() => validateStockMovement({ direction: "in", quantity: 25, toLocationId: 8 })).not.toThrow();
  });

  it("يطبع رمز الشركة ويمنع رمز العملة غير القياسي", () => {
    expect(validateCompanySetup({ legalName: "شركة جراي", companyCode: " gray-01 ", baseCurrency: "sar", timeZone: "Asia/Riyadh" })).toMatchObject({ companyCode: "GRAY-01", baseCurrency: "SAR" });
    expect(() => validateCompanySetup({ legalName: "شركة جراي", companyCode: "GRAY", baseCurrency: "SAR1", timeZone: "Asia/Riyadh" })).toThrow("ثلاثة أحرف");
  });
});

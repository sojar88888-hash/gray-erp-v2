import { describe, expect, it } from "vitest";
import { canPostFinancialEntries, financialReadiness } from "./erp";

describe("بوابة الجاهزية المالية", () => {
  it("تحجب الترحيل المالي افتراضيًا حتى تتوفر أدلة الحوكمة", () => {
    const readiness = financialReadiness();
    expect(readiness.state).toBe("blocked");
    expect(readiness.ready).toBe(false);
    expect(readiness.completed).toBeLessThan(readiness.total);
  });

  it("تحجب الترحيل حتى عن مدير النظام عند غياب الجاهزية", () => {
    expect(canPostFinancialEntries("admin").allowed).toBe(false);
  });
});

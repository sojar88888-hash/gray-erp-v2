import { describe, expect, it } from "vitest";
import { validateAuditEvent } from "./audit";

describe("سجل تدقيق GRAY ERP", () => {
  it("يحجب المفاتيح الحساسة من لقطة حدث التدقيق", () => {
    const event = validateAuditEvent({
      companyId: 1,
      actorUserId: 3,
      action: "update",
      entityType: "customer",
      entityId: "45",
      afterData: { legalName: "شركة المثال", apiKey: "unsafe", nested: { authorization: "unsafe" } },
    });

    expect(event.afterData).toEqual({ legalName: "شركة المثال", apiKey: "[محجوب]", nested: { authorization: "[محجوب]" } });
  });

  it("يرفض الحدث غير المرتبط بشركة أو كيان", () => {
    expect(() => validateAuditEvent({ companyId: 0, actorUserId: null, action: "login", entityType: "", entityId: "" })).toThrow("معرف الشركة");
  });
});

import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { hasPermission, validateOperationalDocumentTransition } from "./erp";

function createUserCaller(role: "admin" | "manager" | "accountant" | "user") {
  const ctx = {
    user: { id: 42, openId: "authorization-test", name: "Authorization Test", email: null, loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: { origin: "https://erp.example.test", host: "erp.example.test" } },
    res: { clearCookie: () => undefined },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

describe("صلاحيات القراءة للبيانات الأساسية", () => {
  it("يرفض قراءة العملاء من مستخدم لا يملك صلاحية المبيعات", async () => {
    await expect(createUserCaller("user").erp.masterData.customers.list()).rejects.toThrow("عرض العملاء");
  });

  it("يسمح للمحاسب بقراءة الموردين كطرف لمسودة نقد ثم يطبّق حارس تهيئة الشركة", async () => {
    await expect(createUserCaller("accountant").erp.masterData.suppliers.list()).rejects.toThrow("إكمال تهيئة الشركة");
  });

  it("يرفض إنشاء صنف من مستخدم لا يملك صلاحية المخزون قبل لمس قاعدة البيانات", async () => {
    await expect(createUserCaller("user").erp.masterData.items.create({ itemCode: "IT-1", name: "صنف اختبار", itemType: "inventory", unitOfMeasure: "وحدة" })).rejects.toThrow("إنشاء صنف");
  });

  it("يرفض قراءة حسابات النقد من مستخدم لا يملك صلاحية المحاسبة", async () => {
    await expect(createUserCaller("user").erp.masterData.cashAccounts.list()).rejects.toThrow("عرض حسابات النقد والبنوك");
  });

  it("يقيد مسودات القبض والصرف بصلاحية المحاسبة قبل لمس البيانات", async () => {
    await expect(createUserCaller("user").erp.cash.drafts.list()).rejects.toThrow("عرض مسودات القبض والصرف");
    await expect(createUserCaller("user").erp.cash.drafts.create({ branchId: 1, cashAccountId: 1, voucherNumber: "RCPT-001", draftKind: "receipt", counterpartyType: "other", counterpartyName: "طرف اختبار", amount: 100, currency: "SAR", transactionDate: new Date("2026-08-21"), narrative: "سند تجريبي" })).rejects.toThrow("إنشاء مسودة قبض أو صرف");
    await expect(createUserCaller("user").erp.cash.drafts.recordPrint({ cashDraftId: 1 })).rejects.toThrow("طباعة مسودة قبض أو صرف");
    await expect(createUserCaller("admin").erp.cash.drafts.recordPrint({ cashDraftId: 0 })).rejects.toThrow();
  });

  it("يتحقق من اتساق طرف مسودة النقد قبل الوصول إلى قاعدة البيانات", async () => {
    await expect(createUserCaller("admin").erp.cash.drafts.create({ branchId: 1, cashAccountId: 1, voucherNumber: "RCPT-001", draftKind: "receipt", counterpartyType: "customer", amount: 100, currency: "SAR", transactionDate: new Date("2026-08-21"), narrative: "سند تجريبي" })).rejects.toThrow();
    await expect(createUserCaller("admin").erp.cash.drafts.create({ branchId: 1, cashAccountId: 1, voucherNumber: "PAY-001", draftKind: "payment", counterpartyType: "other", customerId: 1, counterpartyName: "طرف اختبار", amount: 100, currency: "SAR", transactionDate: new Date("2026-08-21"), narrative: "سند تجريبي" })).rejects.toThrow();
  });

  it("يرفض إنشاء مشروع من محاسب لا يملك صلاحية الإدارة", async () => {
    await expect(createUserCaller("accountant").erp.masterData.projects.create({ projectCode: "PRJ-1", name: "مشروع اختبار" })).rejects.toThrow("إنشاء المشاريع");
  });

  it("يرفض عرض الأصول وسجلات الموارد البشرية من مدير لا يملك صلاحية الإدارة", async () => {
    await expect(createUserCaller("manager").erp.masterData.fixedAssets.list()).rejects.toThrow("عرض الأصول الثابتة");
    await expect(createUserCaller("manager").erp.masterData.employees.list()).rejects.toThrow("عرض سجلات الموارد البشرية");
  });

  it("يرفض عقد حساب نقدي غير صالح قبل تنفيذ الإجراء", async () => {
    await expect(createUserCaller("admin").erp.masterData.cashAccounts.create({ accountCode: "?", name: "صندوق تجريبي", accountKind: "cash_box", currency: "SAR" })).rejects.toThrow();
  });

  it("يرفض عقد مشروع غير صالح أو نطاق تواريخ غير متسق قبل تنفيذ الإجراء", async () => {
    await expect(createUserCaller("admin").erp.masterData.projects.create({ projectCode: "?", name: "مشروع اختبار" })).rejects.toThrow();
    await expect(createUserCaller("admin").erp.masterData.projects.create({ projectCode: "PRJ-1", name: "مشروع اختبار", startsAt: new Date("2026-05-02"), endsAt: new Date("2026-05-01") })).rejects.toThrow("تاريخ انتهاء المشروع");
  });

  it("يرفض عقد أصل ثابت أو موظف غير مكتمل قبل تنفيذ الإجراء", async () => {
    await expect(createUserCaller("admin").erp.masterData.fixedAssets.create({ assetCode: "AST-1", name: "مولد", category: "م" })).rejects.toThrow();
    await expect(createUserCaller("admin").erp.masterData.employees.create({ employeeCode: "EMP-1", fullName: "أب" })).rejects.toThrow();
  });

  it("يقيد إعدادات الشركة بدور الإدارة ويتحقق من عقد السياسة التشغيلية", async () => {
    await expect(createUserCaller("manager").erp.settings.list()).rejects.toThrow("عرض إعدادات الشركة");
    await expect(createUserCaller("admin").erp.settings.upsertOperationalPolicy({ defaultDocumentCurrency: "SR", approvalMode: "controlled", notificationDigestEnabled: true })).rejects.toThrow();
  });

  it("يرفض الوصول إلى سجلات المبيعات والمشتريات من مستخدم بلا صلاحية تشغيلية", async () => {
    await expect(createUserCaller("user").erp.documents.sales.list()).rejects.toThrow("عرض مستندات المبيعات");
    await expect(createUserCaller("user").erp.documents.purchases.list()).rejects.toThrow("عرض مستندات المشتريات");
  });

  it("يقيد الحصول على النسخة الحية وتسجيل طباعتها بالصلاحية التشغيلية ويتحقق من عقد المعرّف", async () => {
    await expect(createUserCaller("user").erp.documents.sales.getPrintable({ documentId: 1 })).rejects.toThrow("طباعة مستندات المبيعات");
    await expect(createUserCaller("user").erp.documents.purchases.recordPrint({ documentId: 1 })).rejects.toThrow("طباعة مستندات المشتريات");
    await expect(createUserCaller("admin").erp.documents.sales.getPrintable({ documentId: 0 })).rejects.toThrow();
    await expect(createUserCaller("admin").erp.documents.purchases.recordPrint({ documentId: 0 })).rejects.toThrow();
  });

  it("يقيد إنشاء الفروع بدور الإدارة ويتحقق من عقد الفرع قبل تنفيذ الإجراء", async () => {
    await expect(createUserCaller("manager").erp.organization.branches.create({ branchCode: "BR-01", name: "فرع اختبار" })).rejects.toThrow("إنشاء فرع");
    await expect(createUserCaller("admin").erp.organization.branches.create({ branchCode: "?", name: "ف" })).rejects.toThrow();
  });

  it("يسمح لصاحب صلاحية تشغيلية بطلب قائمة الفروع ثم يفشل فقط عند غياب نطاق الشركة", async () => {
    await expect(createUserCaller("manager").erp.organization.branches.list()).rejects.toThrow("إكمال تهيئة الشركة");
  });

  it("يرفض عقد مسودة مبيعات غير مكتمل قبل تنفيذ الإجراء", async () => {
    await expect(createUserCaller("admin").erp.documents.sales.createDraft({
      branchId: 1, kind: "quotation", documentNumber: "?", customerId: 1, documentDate: new Date("2026-08-21"), currency: "SAR", lines: [],
    })).rejects.toThrow();
  });

  it("يرفض عقد مسودة مشتريات بسطر غير صالح قبل تنفيذ الإجراء", async () => {
    await expect(createUserCaller("admin").erp.documents.purchases.createDraft({
      branchId: 1, kind: "purchase_request", documentNumber: "PUR-001", supplierId: 1, documentDate: new Date("2026-08-21"), currency: "SAR",
      lines: [{ description: "ب", quantity: 0, unitPrice: -1, taxRate: 101 }],
    })).rejects.toThrow();
  });

  it("يقيد قرار المستند التشغيلي بعقد صالح وصلاحية مراجعة مستقلة", async () => {
    await expect(createUserCaller("admin").erp.documents.sales.updateStatus({ documentId: 0, nextStatus: "approved" })).rejects.toThrow();
    await expect(createUserCaller("user").erp.documents.sales.updateStatus({ documentId: 1, nextStatus: "approved" })).rejects.toThrow("تشغيل مستندات المبيعات");
    await expect(createUserCaller("accountant").erp.documents.purchases.updateStatus({ documentId: 1, nextStatus: "approved" })).rejects.toThrow("تشغيل مستندات المشتريات");
    expect(hasPermission("manager", "documents.review")).toBe(true);
    expect(hasPermission("accountant", "documents.review")).toBe(false);
  });

  it("يفرض تسلسل المراجعة وفصل صانع المستند عن القرار التشغيلي النهائي", () => {
    expect(() => validateOperationalDocumentTransition({ currentStatus: "draft", nextStatus: "approved", createdBy: 10, actorUserId: 20 })).toThrow("انتقال حالة المستند");
    expect(() => validateOperationalDocumentTransition({ currentStatus: "in_review", nextStatus: "approved", createdBy: 10, actorUserId: 10 })).toThrow("لا يمكن لصانع المستند");
    expect(() => validateOperationalDocumentTransition({ currentStatus: "in_review", nextStatus: "approved", createdBy: 10, actorUserId: 20 })).not.toThrow();
  });

  it("يقيد السجل المحاسبي وملخص التقارير بدور يملك صلاحيات القراءة المطلوبة", async () => {
    await expect(createUserCaller("user").erp.accountingRegistry.chartOfAccounts()).rejects.toThrow("عرض دليل الحسابات");
    await expect(createUserCaller("user").erp.accountingRegistry.periods()).rejects.toThrow("عرض الفترات المحاسبية");
    await expect(createUserCaller("user").erp.reports.operationalSummary()).rejects.toThrow("عرض ملخص التقارير التشغيلية");
  });

  it("يقيد دليل المستخدمين وتعديل الأدوار بدور مدير النظام", async () => {
    await expect(createUserCaller("manager").erp.userManagement.list()).rejects.toThrow("عرض مستخدمي الشركة");
    await expect(createUserCaller("accountant").erp.userManagement.updateRole({ targetUserId: 55, role: "user" })).rejects.toThrow("تحديث أدوار المستخدمين");
  });

  it("يتحقق من عقد تحديث الدور ويحمي الحساب الإداري الحالي قبل أي قراءة لنطاق الشركة", async () => {
    await expect(createUserCaller("admin").erp.userManagement.updateRole({ targetUserId: 0, role: "manager" })).rejects.toThrow();
    await expect(createUserCaller("admin").erp.userManagement.updateRole({ targetUserId: 42, role: "user" })).rejects.toThrow("لا يمكن تخفيض أو تغيير دور الحساب الإداري الحالي");
  });

  it("يقيد قراءة مواقع وحركات المخزون بدور يملك صلاحية المخزون", async () => {
    await expect(createUserCaller("user").erp.inventory.locations.list()).rejects.toThrow("عرض مواقع المخزون");
    await expect(createUserCaller("accountant").erp.inventory.movements.list()).rejects.toThrow("عرض حركات المخزون");
  });

  it("يتحقق من عقد موقع المخزون قبل الوصول لطبقة البيانات", async () => {
    await expect(createUserCaller("admin").erp.inventory.locations.create({ branchId: 1, locationCode: "?", name: "م", locationType: "warehouse" })).rejects.toThrow();
    await expect(createUserCaller("admin").erp.inventory.locations.create({ branchId: 1, locationCode: "WH-01", name: "مستودع اختبار", locationType: "tanker", capacity: 0 })).rejects.toThrow();
  });

  it("يتحقق من عقد حركة المخزون ويمنع إدخال الكمية أو الاتجاه غير الصالحين", async () => {
    await expect(createUserCaller("admin").erp.inventory.movements.create({ branchId: 1, itemId: 1, direction: "in", quantity: 0, toLocationId: 1, referenceType: "سند", referenceId: "MOV-1", occurredAt: new Date("2026-08-21") })).rejects.toThrow();
    await expect(createUserCaller("admin").erp.inventory.movements.create({ branchId: 1, itemId: 1, direction: "invalid" as never, quantity: 1, toLocationId: 1, referenceType: "سند", referenceId: "MOV-1", occurredAt: new Date("2026-08-21") })).rejects.toThrow();
  });

  it("يقصر الإدخال اليدوي للمخزون على التحويل المادي بين المواقع", async () => {
    await expect(createUserCaller("admin").erp.inventory.movements.create({ branchId: 1, itemId: 1, direction: "in" as never, quantity: 1, toLocationId: 1, referenceType: "سند", referenceId: "MOV-1", occurredAt: new Date("2026-08-21") })).rejects.toThrow();
    await expect(createUserCaller("admin").erp.inventory.movements.create({ branchId: 1, itemId: 1, direction: "transfer", quantity: 1, fromLocationId: 1, toLocationId: 2, referenceType: "تحويل", referenceId: "TRF-1", occurredAt: new Date("2026-08-21") })).rejects.toThrow("إكمال تهيئة الشركة");
  });

  it("يحمي حركة المستند المعتمد وتسوية الجرد من المستخدم غير المخول ويتحقق من عقودهما", async () => {
    await expect(createUserCaller("user").erp.inventory.movements.fromApprovedDocument({ documentId: 1, locationId: 1, occurredAt: new Date("2026-08-21") })).rejects.toThrow("حركة مخزون من مستند معتمد");
    await expect(createUserCaller("user").erp.inventory.movements.stockCountAdjustment({ branchId: 1, itemId: 1, locationId: 1, adjustmentKind: "increase", quantity: 1, countReference: "COUNT-1", occurredAt: new Date("2026-08-21") })).rejects.toThrow("تسوية جرد");
    await expect(createUserCaller("admin").erp.inventory.movements.fromApprovedDocument({ documentId: 0, locationId: 1, occurredAt: new Date("2026-08-21") })).rejects.toThrow();
    await expect(createUserCaller("admin").erp.inventory.movements.stockCountAdjustment({ branchId: 1, itemId: 1, locationId: 1, adjustmentKind: "increase", quantity: 0, countReference: "X", occurredAt: new Date("2026-08-21") })).rejects.toThrow();
  });

  it("يسمح لمدير بطلب بيانات المخزون ثم يطبّق حارس تهيئة الشركة قبل القراءة", async () => {
    await expect(createUserCaller("manager").erp.inventory.locations.list()).rejects.toThrow("إكمال تهيئة الشركة");
  });
});

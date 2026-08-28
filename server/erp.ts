export const ERP_ROLES = ["admin", "manager", "accountant", "user"] as const;
export type ErpRole = (typeof ERP_ROLES)[number];

export type ErpPermission =
  | "dashboard.read"
  | "sales.create"
  | "purchases.create"
  | "documents.review"
  | "inventory.create"
  | "accounting.read"
  | "accounting.post"
  | "reports.read"
  | "administration.manage"
  | "audit.read";

const rolePermissions: Record<ErpRole, readonly ErpPermission[]> = {
  admin: [
    "dashboard.read",
    "sales.create",
    "purchases.create",
    "documents.review",
    "inventory.create",
    "accounting.read",
    "accounting.post",
    "reports.read",
    "administration.manage",
    "audit.read",
  ],
  manager: [
    "dashboard.read",
    "sales.create",
    "purchases.create",
    "documents.review",
    "inventory.create",
    "accounting.read",
    "reports.read",
    "audit.read",
  ],
  accountant: ["dashboard.read", "accounting.read", "reports.read"],
  user: ["dashboard.read"],
};

export function permissionsForRole(role: ErpRole): readonly ErpPermission[] {
  return rolePermissions[role];
}

export function hasPermission(role: ErpRole, permission: ErpPermission): boolean {
  return permissionsForRole(role).includes(permission);
}

export type OperationalDocumentStatus = "draft" | "in_review" | "approved" | "cancelled";

export function validateOperationalDocumentTransition(input: {
  currentStatus: OperationalDocumentStatus;
  nextStatus: Exclude<OperationalDocumentStatus, "draft">;
  createdBy: number;
  actorUserId: number;
}) {
  const transitions: Record<OperationalDocumentStatus, readonly Exclude<OperationalDocumentStatus, "draft">[]> = {
    draft: ["in_review", "cancelled"],
    in_review: ["approved", "cancelled"],
    approved: [],
    cancelled: [],
  };
  if (!transitions[input.currentStatus].includes(input.nextStatus)) {
    throw new Error("انتقال حالة المستند المطلوب غير مسموح.");
  }
  if (input.nextStatus === "approved" && input.createdBy === input.actorUserId) {
    throw new Error("لا يمكن لصانع المستند اتخاذ القرار التشغيلي النهائي عليه؛ يلزم مستخدم آخر مخول.");
  }
}

export const FINANCIAL_READINESS_GATES = [
  { id: "PRE-01", label: "دليل حسابات معتمد وساري" },
  { id: "PRE-02", label: "فترات مالية وسياسة عملات موثقة" },
  { id: "PRE-03", label: "قواعد ربط وترحيل مراجعة" },
  { id: "PRE-04", label: "فصل واجبات الإنشاء والمراجعة والترحيل" },
  { id: "PRE-05", label: "هوية موافقات وسجل أدلة قابل للتحقق" },
  { id: "PRE-06", label: "بيئة QA وعقد اختبار ومصالحة" },
] as const;

export function financialReadiness() {
  return {
    state: "blocked" as const,
    ready: false,
    completed: 0,
    total: FINANCIAL_READINESS_GATES.length,
    gates: FINANCIAL_READINESS_GATES.map((gate) => ({ ...gate, completed: false })),
    reason: "الترحيل المالي وإصدار القوائم الرسمية محجوبان حتى اكتمال أدلة الحوكمة والاعتماد.",
  };
}

export function canPostFinancialEntries(role: ErpRole) {
  const readiness = financialReadiness();
  return { allowed: readiness.ready && hasPermission(role, "accounting.post"), readiness };
}

export function assertPositiveAmount(value: string | number, fieldLabel: string) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error(`${fieldLabel} يجب أن يكون أكبر من صفر.`);
  }
  return numericValue;
}

export function validateJournalLine(debit: string | number, credit: string | number) {
  const debitValue = Number(debit);
  const creditValue = Number(credit);
  const isValidDebit = Number.isFinite(debitValue) && debitValue >= 0;
  const isValidCredit = Number.isFinite(creditValue) && creditValue >= 0;

  if (!isValidDebit || !isValidCredit || (debitValue === 0 && creditValue === 0) || (debitValue > 0 && creditValue > 0)) {
    throw new Error("يجب أن يحتوي سطر القيد على مبلغ مدين أو دائن واحد موجب فقط.");
  }
}

export function validateStockMovement(input: {
  direction: "in" | "out" | "transfer" | "adjustment";
  quantity: string | number;
  fromLocationId?: number | null;
  toLocationId?: number | null;
}) {
  assertPositiveAmount(input.quantity, "الكمية");

  if (input.direction === "transfer" && (!input.fromLocationId || !input.toLocationId || input.fromLocationId === input.toLocationId)) {
    throw new Error("يتطلب النقل موقع مصدر وموقع وجهة مختلفين.");
  }

  if (input.direction === "in" && !input.toLocationId) {
    throw new Error("تتطلب حركة الإدخال موقع وجهة.");
  }

  if (input.direction === "out" && !input.fromLocationId) {
    throw new Error("تتطلب حركة الإخراج موقع مصدر.");
  }
}

export function validateCompanySetup(input: { legalName: string; companyCode: string; baseCurrency: string; timeZone: string }) {
  const legalName = input.legalName.trim();
  const companyCode = input.companyCode.trim().toUpperCase();
  const baseCurrency = input.baseCurrency.trim().toUpperCase();
  const timeZone = input.timeZone.trim();

  if (legalName.length < 3) throw new Error("الاسم القانوني للشركة يجب أن يتكون من 3 أحرف على الأقل.");
  if (!/^[A-Z0-9_-]{2,32}$/.test(companyCode)) throw new Error("رمز الشركة يجب أن يحتوي أحرفًا إنجليزية أو أرقامًا أو شرطات فقط.");
  if (!/^[A-Z]{3}$/.test(baseCurrency)) throw new Error("العملة الأساسية يجب أن تكون رمزًا من ثلاثة أحرف.");
  if (!timeZone) throw new Error("المنطقة الزمنية مطلوبة.");

  return { legalName, companyCode, baseCurrency, timeZone };
}

import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { accountingPeriods, auditEvents, branches, cashAccounts, cashDrafts, chartOfAccounts, commercialDocumentLines, commercialDocuments, companies, companySettings, customers, employees, fixedAssets, InsertUser, inventoryLocations, inventoryMovements, items, projects, suppliers, userScopes, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { AuditEventInput, validateAuditEvent } from "./audit";
import { validateOperationalDocumentTransition } from "./erp";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * يضيف حدثًا جديدًا فقط. لا توجد دالة تحديث أو حذف لسجل التدقيق ضمن التطبيق.
 * يجب استدعاؤها من إجراء خادمي مصادق عليه بعد نجاح العملية الأساسية.
 */
export async function appendAuditEvent(input: AuditEventInput): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Audit] Cannot append event: database not available");
    return false;
  }

  const event = validateAuditEvent(input);
  await db.insert(auditEvents).values({
    companyId: event.companyId,
    actorUserId: event.actorUserId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    requestId: event.requestId ?? null,
    beforeData: event.beforeData ?? null,
    afterData: event.afterData ?? null,
  });

  return true;
}

export async function createInitialCompany(input: {
  legalName: string;
  companyCode: string;
  baseCurrency: string;
  timeZone: string;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");

  return db.transaction(async (tx) => {
    const existingScope = await tx.select({ id: userScopes.id }).from(userScopes).where(eq(userScopes.userId, input.actorUserId)).limit(1);
    if (existingScope.length > 0) throw new Error("تمت تهيئة نطاق شركة لهذا الحساب بالفعل.");

    const insertedCompanies = await tx.insert(companies).values({
      legalName: input.legalName,
      companyCode: input.companyCode,
      baseCurrency: input.baseCurrency,
      timeZone: input.timeZone,
    }).$returningId();
    const companyId = insertedCompanies[0]?.id;
    if (!companyId) throw new Error("تعذر إنشاء الشركة.");

    const insertedBranches = await tx.insert(branches).values({
      companyId,
      branchCode: "HQ",
      name: "المركز الرئيسي",
    }).$returningId();
    const defaultBranchId = insertedBranches[0]?.id;
    if (!defaultBranchId) throw new Error("تعذر إنشاء الفرع الرئيسي للشركة.");

    await tx.insert(userScopes).values({
      userId: input.actorUserId,
      companyId,
      dataScope: "company",
    });

    await tx.insert(auditEvents).values({
      companyId,
      actorUserId: input.actorUserId,
      action: "create",
      entityType: "company",
      entityId: String(companyId),
      afterData: { legalName: input.legalName, companyCode: input.companyCode, baseCurrency: input.baseCurrency, timeZone: input.timeZone },
    });

    await tx.insert(auditEvents).values({
      companyId,
      actorUserId: input.actorUserId,
      action: "create",
      entityType: "branch",
      entityId: String(defaultBranchId),
      afterData: { branchCode: "HQ", name: "المركز الرئيسي", isDefault: true },
    });

    return { companyId, defaultBranchId };
  });
}

export async function getCompanySetupForUser(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select({ id: companies.id, legalName: companies.legalName, companyCode: companies.companyCode, baseCurrency: companies.baseCurrency, timeZone: companies.timeZone })
    .from(userScopes)
    .innerJoin(companies, eq(userScopes.companyId, companies.id))
    .where(and(eq(userScopes.userId, userId), eq(userScopes.isActive, 1), eq(companies.isActive, 1)))
    .limit(1);

  return result[0];
}

async function requireCompanyForUser(userId: number) {
  const company = await getCompanySetupForUser(userId);
  if (!company) throw new Error("يلزم إكمال تهيئة الشركة قبل إدخال بيانات هذه الوحدة.");
  return company;
}

export async function listBranchesForUser(userId: number) {
  const company = await requireCompanyForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.select({ id: branches.id, branchCode: branches.branchCode, name: branches.name, isActive: branches.isActive }).from(branches).where(and(eq(branches.companyId, company.id), eq(branches.isActive, 1))).orderBy(branches.name);
}

export async function createBranchForUser(input: { userId: number; branchCode: string; name: string }) {
  const company = await requireCompanyForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const branchCode = input.branchCode.trim().toUpperCase();
  const name = input.name.trim();
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(branches).values({ companyId: company.id, branchCode, name }).$returningId();
    const branchId = inserted[0]?.id;
    if (!branchId) throw new Error("تعذر إنشاء الفرع.");
    await tx.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "create", entityType: "branch", entityId: String(branchId), afterData: { branchCode, name } });
    return { branchId };
  });
}

export async function listCompanyUsersForAdmin(userId: number) {
  const company = await requireCompanyForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const scopeRows = await db.select({ userId: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn, dataScope: userScopes.dataScope, branchName: branches.name, branchCode: branches.branchCode }).from(userScopes).innerJoin(users, eq(userScopes.userId, users.id)).leftJoin(branches, and(eq(userScopes.branchId, branches.id), eq(branches.companyId, company.id))).where(and(eq(userScopes.companyId, company.id), eq(userScopes.isActive, 1))).orderBy(users.name, users.id);
  const directory = new Map<number, { userId: number; name: string | null; email: string | null; role: "admin" | "manager" | "accountant" | "user"; lastSignedIn: Date; scopeSummary: string[] }>();
  for (const row of scopeRows) {
    const existing = directory.get(row.userId);
    const scopeLabel = row.dataScope === "company" ? "نطاق الشركة" : row.branchCode ? `فرع ${row.branchCode} — ${row.branchName ?? ""}` : row.dataScope === "branch" ? "نطاق فرع" : "نطاق مخصص";
    if (existing) existing.scopeSummary.push(scopeLabel);
    else directory.set(row.userId, { userId: row.userId, name: row.name, email: row.email, role: row.role, lastSignedIn: row.lastSignedIn, scopeSummary: [scopeLabel] });
  }
  return Array.from(directory.values());
}

export async function updateCompanyUserRoleForAdmin(input: { actorUserId: number; targetUserId: number; role: "admin" | "manager" | "accountant" | "user" }) {
  if (input.actorUserId === input.targetUserId) throw new Error("لا يمكن تخفيض أو تغيير دور الحساب الإداري الحالي من هذه الواجهة.");
  const company = await requireCompanyForUser(input.actorUserId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.transaction(async (tx) => {
    const targetScope = await tx.select({ id: userScopes.id }).from(userScopes).where(and(eq(userScopes.userId, input.targetUserId), eq(userScopes.companyId, company.id), eq(userScopes.isActive, 1))).limit(1);
    if (!targetScope[0]) throw new Error("المستخدم المستهدف لا ينتمي إلى نطاق هذه الشركة.");
    const target = await tx.select({ id: users.id, role: users.role, name: users.name }).from(users).where(eq(users.id, input.targetUserId)).limit(1);
    if (!target[0]) throw new Error("المستخدم المستهدف غير موجود.");
    const crossCompanyScope = await tx.select({ companyId: userScopes.companyId }).from(userScopes).where(and(eq(userScopes.userId, input.targetUserId), eq(userScopes.isActive, 1)));
    if (crossCompanyScope.some((scope) => scope.companyId !== company.id)) throw new Error("دور المستخدم مركزي ويشمل نطاق شركة أخرى؛ يلزم تعديل الدور من مسار حوكمة مركزي.");
    if (target[0].role === "admin" && input.role !== "admin") {
      const companyAdmins = await tx.select({ userId: users.id }).from(userScopes).innerJoin(users, eq(userScopes.userId, users.id)).where(and(eq(userScopes.companyId, company.id), eq(userScopes.isActive, 1), eq(users.role, "admin")));
      const hasOtherAdmin = companyAdmins.some((member) => member.userId !== input.targetUserId);
      if (!hasOtherAdmin) throw new Error("لا يمكن إزالة آخر مدير نظام نشط ضمن نطاق الشركة.");
    }
    await tx.update(users).set({ role: input.role }).where(eq(users.id, input.targetUserId));
    await tx.insert(auditEvents).values({ companyId: company.id, actorUserId: input.actorUserId, action: "update", entityType: "user_role", entityId: String(input.targetUserId), beforeData: { role: target[0].role, name: target[0].name }, afterData: { role: input.role, name: target[0].name } });
    return { userId: input.targetUserId, previousRole: target[0].role, role: input.role };
  });
}

export async function listCustomersForUser(userId: number) {
  const company = await requireCompanyForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.select().from(customers).where(eq(customers.companyId, company.id)).orderBy(customers.legalName);
}

export async function createCustomerForUser(input: { userId: number; customerCode: string; legalName: string; taxNumber?: string; phone?: string; email?: string }) {
  const company = await requireCompanyForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const customerCode = input.customerCode.trim().toUpperCase();
  const legalName = input.legalName.trim();

  return db.transaction(async (tx) => {
    const inserted = await tx.insert(customers).values({ companyId: company.id, customerCode, legalName, taxNumber: input.taxNumber?.trim() || null, phone: input.phone?.trim() || null, email: input.email?.trim() || null }).$returningId();
    const customerId = inserted[0]?.id;
    if (!customerId) throw new Error("تعذر إنشاء سجل العميل.");
    await tx.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "create", entityType: "customer", entityId: String(customerId), afterData: { customerCode, legalName } });
    return { customerId };
  });
}

export async function listSuppliersForUser(userId: number) {
  const company = await requireCompanyForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.select().from(suppliers).where(eq(suppliers.companyId, company.id)).orderBy(suppliers.legalName);
}

export async function createSupplierForUser(input: { userId: number; supplierCode: string; legalName: string; taxNumber?: string; phone?: string; email?: string }) {
  const company = await requireCompanyForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const supplierCode = input.supplierCode.trim().toUpperCase();
  const legalName = input.legalName.trim();
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(suppliers).values({ companyId: company.id, supplierCode, legalName, taxNumber: input.taxNumber?.trim() || null, phone: input.phone?.trim() || null, email: input.email?.trim() || null }).$returningId();
    const supplierId = inserted[0]?.id;
    if (!supplierId) throw new Error("تعذر إنشاء سجل المورد.");
    await tx.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "create", entityType: "supplier", entityId: String(supplierId), afterData: { supplierCode, legalName } });
    return { supplierId };
  });
}

export async function listItemsForUser(userId: number) {
  const company = await requireCompanyForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.select().from(items).where(eq(items.companyId, company.id)).orderBy(items.name);
}

export async function createItemForUser(input: { userId: number; itemCode: string; name: string; itemType: "inventory" | "fuel" | "service"; unitOfMeasure: string }) {
  const company = await requireCompanyForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const itemCode = input.itemCode.trim().toUpperCase();
  const name = input.name.trim();
  const unitOfMeasure = input.unitOfMeasure.trim();
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(items).values({ companyId: company.id, itemCode, name, itemType: input.itemType, unitOfMeasure }).$returningId();
    const itemId = inserted[0]?.id;
    if (!itemId) throw new Error("تعذر إنشاء سجل الصنف.");
    await tx.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "create", entityType: "item", entityId: String(itemId), afterData: { itemCode, name, itemType: input.itemType, unitOfMeasure } });
    return { itemId };
  });
}

export async function listAuditEventsForUser(userId: number) {
  const company = await requireCompanyForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.select({ id: auditEvents.id, actorUserId: auditEvents.actorUserId, action: auditEvents.action, entityType: auditEvents.entityType, entityId: auditEvents.entityId, occurredAt: auditEvents.occurredAt }).from(auditEvents).where(eq(auditEvents.companyId, company.id)).orderBy(desc(auditEvents.occurredAt)).limit(50);
}

export async function listCashAccountsForUser(userId: number) {
  const company = await requireCompanyForUser(userId); const db = await getDb(); if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.select().from(cashAccounts).where(eq(cashAccounts.companyId, company.id)).orderBy(cashAccounts.name);
}

export async function createCashAccountForUser(input: { userId: number; accountCode: string; name: string; accountKind: "bank" | "cash_box"; currency: string; bankName?: string; accountReference?: string }) {
  const company = await requireCompanyForUser(input.userId); const db = await getDb(); if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const accountCode = input.accountCode.trim().toUpperCase(); const name = input.name.trim(); const currency = input.currency.trim().toUpperCase();
  return db.transaction(async (tx) => { const inserted = await tx.insert(cashAccounts).values({ companyId: company.id, accountCode, name, accountKind: input.accountKind, currency, bankName: input.bankName?.trim() || null, accountReference: input.accountReference?.trim() || null, createdBy: input.userId }).$returningId(); const id = inserted[0]?.id; if (!id) throw new Error("تعذر إنشاء حساب النقد أو البنك."); await tx.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "create", entityType: "cash_account", entityId: String(id), afterData: { accountCode, name, accountKind: input.accountKind, currency } }); return { id }; });
}

export async function listCashDraftsForUser(userId: number, branchId?: number) {
  const company = await requireCompanyForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  if (branchId) await requireAccessibleBranchForUser(userId, company.id, branchId);
  const drafts = await db.select().from(cashDrafts).where(eq(cashDrafts.companyId, company.id)).orderBy(desc(cashDrafts.transactionDate));
  return branchId ? drafts.filter((draft) => draft.branchId === branchId) : drafts;
}

export async function createCashDraftForUser(input: { userId: number; branchId: number; cashAccountId: number; voucherNumber: string; draftKind: "receipt" | "payment"; counterpartyType: "customer" | "supplier" | "other"; customerId?: number; supplierId?: number; counterpartyName?: string; amount: number; currency: string; transactionDate: Date; narrative: string }) {
  const company = await requireCompanyForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  await requireAccessibleBranchForUser(input.userId, company.id, input.branchId);
  const voucherNumber = input.voucherNumber.trim().toUpperCase();
  const currency = input.currency.trim().toUpperCase();
  const narrative = input.narrative.trim();
  const counterpartyName = input.counterpartyName?.trim() || null;
  const account = (await db.select({ id: cashAccounts.id, currency: cashAccounts.currency, status: cashAccounts.status }).from(cashAccounts).where(and(eq(cashAccounts.id, input.cashAccountId), eq(cashAccounts.companyId, company.id))).limit(1))[0];
  if (!account || account.status !== "active") throw new Error("حساب النقد أو البنك المختار غير نشط أو لا يتبع الشركة.");
  if (account.currency !== currency) throw new Error("عملة المسودة يجب أن تطابق عملة حساب النقد أو البنك.");
  if (input.counterpartyType === "customer") {
    if (!input.customerId || input.supplierId) throw new Error("يلزم اختيار عميل فقط لمسودة القبض أو الصرف الخاصة بالعميل.");
    const customer = (await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.companyId, company.id))).limit(1))[0];
    if (!customer) throw new Error("العميل المختار لا يتبع الشركة.");
  } else if (input.counterpartyType === "supplier") {
    if (!input.supplierId || input.customerId) throw new Error("يلزم اختيار مورد فقط لمسودة القبض أو الصرف الخاصة بالمورد.");
    const supplier = (await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, input.supplierId), eq(suppliers.companyId, company.id))).limit(1))[0];
    if (!supplier) throw new Error("المورد المختار لا يتبع الشركة.");
  } else if (!counterpartyName || input.customerId || input.supplierId) {
    throw new Error("يلزم إدخال اسم الطرف الآخر فقط دون ربط عميل أو مورد.");
  }
  const inserted = await db.transaction(async (tx) => {
    const result = await tx.insert(cashDrafts).values({ companyId: company.id, branchId: input.branchId, cashAccountId: input.cashAccountId, voucherNumber, draftKind: input.draftKind, counterpartyType: input.counterpartyType, customerId: input.counterpartyType === "customer" ? input.customerId! : null, supplierId: input.counterpartyType === "supplier" ? input.supplierId! : null, counterpartyName, amount: String(input.amount), currency, transactionDate: input.transactionDate, narrative, status: "draft", createdBy: input.userId }).$returningId();
    const id = result[0]?.id;
    if (!id) throw new Error("تعذر إنشاء مسودة القبض أو الصرف.");
    await tx.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "create", entityType: "cash_draft", entityId: String(id), afterData: { branchId: input.branchId, cashAccountId: input.cashAccountId, voucherNumber, draftKind: input.draftKind, counterpartyType: input.counterpartyType, amount: input.amount, currency, financialPosting: false, approvalStatus: "not_authorized" } });
    return id;
  });
  return { draftId: inserted, status: "draft" as const, financialPosting: false as const, authorization: "not_authorized" as const };
}

export async function recordCashDraftPrintForUser(input: { userId: number; cashDraftId: number }) {
  const company = await requireCompanyForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const draft = (await db.select({ id: cashDrafts.id, branchId: cashDrafts.branchId, status: cashDrafts.status, voucherNumber: cashDrafts.voucherNumber }).from(cashDrafts).where(and(eq(cashDrafts.id, input.cashDraftId), eq(cashDrafts.companyId, company.id))).limit(1))[0];
  if (!draft) throw new Error("مسودة النقد غير متاحة ضمن نطاق الشركة.");
  await requireAccessibleBranchForUser(input.userId, company.id, draft.branchId);
  const inserted = await db.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "export", entityType: "cash_draft", entityId: String(draft.id), afterData: { voucherNumber: draft.voucherNumber, status: draft.status, output: "browser_print", financialPosting: false, authorization: "not_authorized" } }).$returningId();
  return { auditEventId: inserted[0]?.id ?? null, financialPosting: false as const, authorization: "not_authorized" as const };
}

export async function listProjectsForUser(userId: number) {
  const company = await requireCompanyForUser(userId); const db = await getDb(); if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.select().from(projects).where(eq(projects.companyId, company.id)).orderBy(projects.name);
}

export async function createProjectForUser(input: { userId: number; projectCode: string; name: string; startsAt?: Date; endsAt?: Date }) {
  const company = await requireCompanyForUser(input.userId); const db = await getDb(); if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const projectCode = input.projectCode.trim().toUpperCase(); const name = input.name.trim();
  return db.transaction(async (tx) => { const inserted = await tx.insert(projects).values({ companyId: company.id, projectCode, name, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, createdBy: input.userId }).$returningId(); const id = inserted[0]?.id; if (!id) throw new Error("تعذر إنشاء المشروع."); await tx.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "create", entityType: "project", entityId: String(id), afterData: { projectCode, name } }); return { id }; });
}

export async function listFixedAssetsForUser(userId: number) {
  const company = await requireCompanyForUser(userId); const db = await getDb(); if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.select().from(fixedAssets).where(eq(fixedAssets.companyId, company.id)).orderBy(fixedAssets.name);
}

export async function createFixedAssetForUser(input: { userId: number; assetCode: string; name: string; category: string; serialNumber?: string; locationDescription?: string }) {
  const company = await requireCompanyForUser(input.userId); const db = await getDb(); if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const assetCode = input.assetCode.trim().toUpperCase(); const name = input.name.trim(); const category = input.category.trim();
  return db.transaction(async (tx) => { const inserted = await tx.insert(fixedAssets).values({ companyId: company.id, assetCode, name, category, serialNumber: input.serialNumber?.trim() || null, locationDescription: input.locationDescription?.trim() || null, createdBy: input.userId }).$returningId(); const id = inserted[0]?.id; if (!id) throw new Error("تعذر إنشاء سجل الأصل."); await tx.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "create", entityType: "fixed_asset", entityId: String(id), afterData: { assetCode, name, category } }); return { id }; });
}

export async function listEmployeesForUser(userId: number) {
  const company = await requireCompanyForUser(userId); const db = await getDb(); if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.select().from(employees).where(eq(employees.companyId, company.id)).orderBy(employees.fullName);
}

export async function createEmployeeForUser(input: { userId: number; employeeCode: string; fullName: string; department?: string; jobTitle?: string; workEmail?: string }) {
  const company = await requireCompanyForUser(input.userId); const db = await getDb(); if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const employeeCode = input.employeeCode.trim().toUpperCase(); const fullName = input.fullName.trim();
  return db.transaction(async (tx) => { const inserted = await tx.insert(employees).values({ companyId: company.id, employeeCode, fullName, department: input.department?.trim() || null, jobTitle: input.jobTitle?.trim() || null, workEmail: input.workEmail?.trim() || null, createdBy: input.userId }).$returningId(); const id = inserted[0]?.id; if (!id) throw new Error("تعذر إنشاء سجل الموظف."); await tx.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "create", entityType: "employee", entityId: String(id), afterData: { employeeCode, fullName } }); return { id }; });
}

export async function listCompanySettingsForUser(userId: number) {
  const company = await requireCompanyForUser(userId); const db = await getDb(); if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.select({ id: companySettings.id, settingKey: companySettings.settingKey, settingValue: companySettings.settingValue, updatedAt: companySettings.updatedAt }).from(companySettings).where(eq(companySettings.companyId, company.id)).orderBy(companySettings.settingKey);
}

export async function upsertCompanySettingForUser(input: { userId: number; settingKey: "operational_policy"; settingValue: { defaultDocumentCurrency: string; approvalMode: "controlled" | "manual_review"; notificationDigestEnabled: boolean } }) {
  const company = await requireCompanyForUser(input.userId); const db = await getDb(); if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: companySettings.id, settingValue: companySettings.settingValue }).from(companySettings).where(and(eq(companySettings.companyId, company.id), eq(companySettings.settingKey, input.settingKey))).limit(1);
    const previous = existing[0];
    let settingId = previous?.id;
    if (settingId) {
      await tx.update(companySettings).set({ settingValue: input.settingValue, updatedBy: input.userId }).where(eq(companySettings.id, settingId));
    } else {
      const inserted = await tx.insert(companySettings).values({ companyId: company.id, settingKey: input.settingKey, settingValue: input.settingValue, updatedBy: input.userId }).$returningId();
      settingId = inserted[0]?.id;
    }
    if (!settingId) throw new Error("تعذر حفظ إعدادات الشركة.");
    const event = validateAuditEvent({ companyId: company.id, actorUserId: input.userId, action: previous ? "update" : "create", entityType: "company_setting", entityId: String(settingId), beforeData: previous?.settingValue as Record<string, unknown> | undefined, afterData: { settingKey: input.settingKey, settingValue: input.settingValue } });
    await tx.insert(auditEvents).values({ companyId: event.companyId, actorUserId: event.actorUserId, action: event.action, entityType: event.entityType, entityId: event.entityId, requestId: event.requestId ?? null, beforeData: event.beforeData ?? null, afterData: event.afterData ?? null });
    return { settingId, created: !previous };
  });
}

type CommercialDraftKind = "quotation" | "sales_invoice" | "purchase_request" | "purchase_order";

type CommercialDraftLine = {
  itemId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
};

async function requireAccessibleBranchForUser(userId: number, companyId: number, branchId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const [scope, branch] = await Promise.all([
    db.select({ dataScope: userScopes.dataScope, branchId: userScopes.branchId }).from(userScopes).where(and(eq(userScopes.userId, userId), eq(userScopes.companyId, companyId), eq(userScopes.isActive, 1))).limit(1),
    db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, branchId), eq(branches.companyId, companyId), eq(branches.isActive, 1))).limit(1),
  ]);
  if (!branch[0]) throw new Error("الفرع المختار غير موجود أو غير نشط ضمن نطاق الشركة.");
  const activeScope = scope[0];
  if (!activeScope || (activeScope.dataScope !== "company" && activeScope.branchId !== branchId)) throw new Error("لا يتيح نطاق صلاحيتك إنشاء مستندات لهذا الفرع.");
  return branch[0];
}

function monetary(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function listCommercialDocumentsForUser(userId: number, kinds?: CommercialDraftKind[]) {
  const company = await requireCompanyForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const documents = await db.select().from(commercialDocuments).where(eq(commercialDocuments.companyId, company.id)).orderBy(desc(commercialDocuments.createdAt));
  return kinds ? documents.filter((document) => kinds.includes(document.kind as CommercialDraftKind)) : documents;
}

export async function getPrintableCommercialDocumentForUser(input: { userId: number; documentId: number; allowedKinds: CommercialDraftKind[] }) {
  const company = await requireCompanyForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");

  const document = (await db.select().from(commercialDocuments).where(and(eq(commercialDocuments.id, input.documentId), eq(commercialDocuments.companyId, company.id))).limit(1))[0];
  if (!document || !input.allowedKinds.includes(document.kind as CommercialDraftKind)) throw new Error("المستند المطلوب غير متاح ضمن نطاق الوحدة.");
  await requireAccessibleBranchForUser(input.userId, company.id, document.branchId);

  const [branch, lines] = await Promise.all([
    db.select({ branchCode: branches.branchCode, name: branches.name }).from(branches).where(and(eq(branches.id, document.branchId), eq(branches.companyId, company.id))).limit(1),
    db.select({ lineNumber: commercialDocumentLines.lineNumber, description: commercialDocumentLines.description, quantity: commercialDocumentLines.quantity, unitPrice: commercialDocumentLines.unitPrice, taxRate: commercialDocumentLines.taxRate, lineTotal: commercialDocumentLines.lineTotal }).from(commercialDocumentLines).where(eq(commercialDocumentLines.documentId, document.id)).orderBy(commercialDocumentLines.lineNumber),
  ]);
  if (!branch[0]) throw new Error("الفرع المرتبط بالمستند غير متاح ضمن نطاق الشركة.");

  const party = document.customerId
    ? (await db.select({ legalName: customers.legalName, taxNumber: customers.taxNumber, phone: customers.phone, email: customers.email }).from(customers).where(and(eq(customers.id, document.customerId), eq(customers.companyId, company.id))).limit(1))[0] ?? null
    : document.supplierId
      ? (await db.select({ legalName: suppliers.legalName, taxNumber: suppliers.taxNumber, phone: suppliers.phone, email: suppliers.email }).from(suppliers).where(and(eq(suppliers.id, document.supplierId), eq(suppliers.companyId, company.id))).limit(1))[0] ?? null
      : null;

  return {
    company: { legalName: company.legalName, companyCode: company.companyCode },
    branch: branch[0],
    document,
    party,
    lines,
    printScope: "operational_live_copy" as const,
  };
}

export async function recordCommercialDocumentPrintForUser(input: { userId: number; documentId: number; allowedKinds: CommercialDraftKind[] }) {
  const printable = await getPrintableCommercialDocumentForUser(input);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  await db.insert(auditEvents).values({
    companyId: printable.document.companyId,
    actorUserId: input.userId,
    action: "export",
    entityType: "commercial_document",
    entityId: String(printable.document.id),
    afterData: { documentNumber: printable.document.documentNumber, printScope: printable.printScope, financialPosting: false },
  });
  return printable;
}

export async function createCommercialDraftForUser(input: {
  userId: number;
  branchId: number;
  kind: CommercialDraftKind;
  documentNumber: string;
  customerId?: number;
  supplierId?: number;
  documentDate: Date;
  dueDate?: Date;
  currency: string;
  notes?: string;
  lines: CommercialDraftLine[];
}) {
  const company = await requireCompanyForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  await requireAccessibleBranchForUser(input.userId, company.id, input.branchId);
  const salesDocument = input.kind === "quotation" || input.kind === "sales_invoice";
  const purchaseDocument = input.kind === "purchase_request" || input.kind === "purchase_order";
  if (salesDocument && !input.customerId) throw new Error("يلزم اختيار عميل نشط لمسودة المبيعات.");
  if (purchaseDocument && !input.supplierId) throw new Error("يلزم اختيار مورد نشط لمسودة المشتريات.");
  if (input.customerId) {
    const customer = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.companyId, company.id), eq(customers.status, "active"))).limit(1);
    if (!customer[0]) throw new Error("العميل المختار غير متاح ضمن نطاق الشركة.");
  }
  if (input.supplierId) {
    const supplier = await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, input.supplierId), eq(suppliers.companyId, company.id), eq(suppliers.status, "active"))).limit(1);
    if (!supplier[0]) throw new Error("المورد المختار غير متاح ضمن نطاق الشركة.");
  }
  if (input.dueDate && input.dueDate < input.documentDate) throw new Error("لا يمكن أن يسبق تاريخ الاستحقاق تاريخ المستند.");

  const itemIds = Array.from(new Set(input.lines.map(line => line.itemId).filter((id): id is number => id !== undefined)));
  if (itemIds.length > 0) {
    const ownedItems = await db
      .select({ id: items.id })
      .from(items)
      .where(and(inArray(items.id, itemIds), eq(items.companyId, company.id), eq(items.isActive, 1)));
    const ownedItemIds = new Set(ownedItems.map(item => item.id));
    const invalidItemId = itemIds.find(itemId => !ownedItemIds.has(itemId));
    if (invalidItemId !== undefined) {
      throw new Error("الصنف المختار غير موجود أو غير متاح ضمن نطاق الشركة.");
    }
  }

  const documentNumber = input.documentNumber.trim().toUpperCase();
  const currency = input.currency.trim().toUpperCase();
  const preparedLines = input.lines.map((line, index) => {
    const net = monetary(line.quantity * line.unitPrice);
    const tax = monetary(net * (line.taxRate / 100));
    return { ...line, lineNumber: index + 1, description: line.description.trim(), net, tax, lineTotal: monetary(net + tax) };
  });
  const subtotal = monetary(preparedLines.reduce((sum, line) => sum + line.net, 0));
  const taxAmount = monetary(preparedLines.reduce((sum, line) => sum + line.tax, 0));
  const totalAmount = monetary(preparedLines.reduce((sum, line) => sum + line.lineTotal, 0));

  return db.transaction(async (tx) => {
    const inserted = await tx.insert(commercialDocuments).values({
      companyId: company.id,
      branchId: input.branchId,
      kind: input.kind,
      status: "draft",
      documentNumber,
      customerId: input.customerId ?? null,
      supplierId: input.supplierId ?? null,
      documentDate: input.documentDate,
      dueDate: input.dueDate ?? null,
      currency,
      subtotal: String(subtotal),
      taxAmount: String(taxAmount),
      totalAmount: String(totalAmount),
      notes: input.notes?.trim() || null,
      createdBy: input.userId,
    }).$returningId();
    const documentId = inserted[0]?.id;
    if (!documentId) throw new Error("تعذر إنشاء مسودة المستند التجاري.");
    await tx.insert(commercialDocumentLines).values(preparedLines.map((line) => ({ documentId, lineNumber: line.lineNumber, itemId: line.itemId ?? null, description: line.description, quantity: String(line.quantity), unitPrice: String(line.unitPrice), taxRate: String(line.taxRate), lineTotal: String(line.lineTotal) })));
    await tx.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "create", entityType: "commercial_document", entityId: String(documentId), afterData: { documentNumber, kind: input.kind, status: "draft", branchId: input.branchId, lineCount: preparedLines.length, currency } });
    return { documentId, status: "draft" as const, subtotal, taxAmount, totalAmount };
  });
}

export type CommercialDocumentLifecycleStatus = "in_review" | "approved" | "cancelled";

export async function updateCommercialDocumentStatusForUser(input: {
  userId: number;
  documentId: number;
  nextStatus: CommercialDocumentLifecycleStatus;
  allowedKinds: CommercialDraftKind[];
  reason?: string;
}) {
  const company = await requireCompanyForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");

  const current = await db.select({
    id: commercialDocuments.id,
    kind: commercialDocuments.kind,
    status: commercialDocuments.status,
    documentNumber: commercialDocuments.documentNumber,
    branchId: commercialDocuments.branchId,
    createdBy: commercialDocuments.createdBy,
  }).from(commercialDocuments).where(and(eq(commercialDocuments.id, input.documentId), eq(commercialDocuments.companyId, company.id))).limit(1);
  const document = current[0];
  if (!document || !input.allowedKinds.includes(document.kind as CommercialDraftKind)) throw new Error("المستند المطلوب غير متاح ضمن نطاق الوحدة.");
  await requireAccessibleBranchForUser(input.userId, company.id, document.branchId);

  validateOperationalDocumentTransition({
    currentStatus: document.status,
    nextStatus: input.nextStatus,
    createdBy: document.createdBy,
    actorUserId: input.userId,
  });

  const reason = input.reason?.trim() || null;
  const action = input.nextStatus === "approved" ? "approve" : input.nextStatus === "cancelled" ? "cancel" : "update";
  await db.transaction(async (tx) => {
    const updated = await tx.update(commercialDocuments).set({ status: input.nextStatus }).where(and(
      eq(commercialDocuments.id, document.id),
      eq(commercialDocuments.companyId, company.id),
      eq(commercialDocuments.status, document.status),
    ));
    if (updated[0].affectedRows !== 1) throw new Error("تغيرت حالة المستند قبل تنفيذ الطلب؛ حدّث القائمة وأعد المحاولة.");
    await tx.insert(auditEvents).values({
      companyId: company.id,
      actorUserId: input.userId,
      action,
      entityType: "commercial_document",
      entityId: String(document.id),
      beforeData: { documentNumber: document.documentNumber, kind: document.kind, status: document.status },
      afterData: {
        documentNumber: document.documentNumber,
        kind: document.kind,
        status: input.nextStatus,
        reason,
        decisionScope: "operational_non_financial",
        financialPosting: false,
      },
    });
  });
  return { documentId: document.id, previousStatus: document.status, status: input.nextStatus, operationalReviewOnly: true as const };
}

type InventoryDirection = "in" | "out" | "transfer" | "adjustment";

async function requireAccessibleInventoryLocation(userId: number, companyId: number, branchId: number, locationId: number) {
  await requireAccessibleBranchForUser(userId, companyId, branchId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const location = await db.select({ id: inventoryLocations.id, branchId: inventoryLocations.branchId }).from(inventoryLocations).where(and(eq(inventoryLocations.id, locationId), eq(inventoryLocations.companyId, companyId), eq(inventoryLocations.isActive, 1))).limit(1);
  if (!location[0] || location[0].branchId !== branchId) throw new Error("موقع المخزون المختار غير نشط أو لا يتبع الفرع المحدد.");
  return location[0];
}

export async function listInventoryLocationsForUser(userId: number, branchId?: number) {
  const company = await requireCompanyForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  if (branchId) await requireAccessibleBranchForUser(userId, company.id, branchId);
  const locations = await db.select().from(inventoryLocations).where(eq(inventoryLocations.companyId, company.id)).orderBy(inventoryLocations.locationCode);
  return branchId ? locations.filter((location) => location.branchId === branchId) : locations;
}

export async function createInventoryLocationForUser(input: { userId: number; branchId: number; locationCode: string; name: string; locationType: "warehouse" | "ground_tank" | "tanker"; capacity?: number }) {
  const company = await requireCompanyForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  await requireAccessibleBranchForUser(input.userId, company.id, input.branchId);
  const locationCode = input.locationCode.trim().toUpperCase();
  const name = input.name.trim();
  const existing = await db.select({ id: inventoryLocations.id }).from(inventoryLocations).where(and(eq(inventoryLocations.companyId, company.id), eq(inventoryLocations.locationCode, locationCode))).limit(1);
  if (existing[0]) throw new Error("رمز موقع المخزون مستخدم مسبقًا ضمن الشركة.");
  const inserted = await db.insert(inventoryLocations).values({ companyId: company.id, branchId: input.branchId, locationCode, name, locationType: input.locationType, capacity: input.capacity === undefined ? null : String(input.capacity) }).$returningId();
  const locationId = inserted[0]?.id;
  if (!locationId) throw new Error("تعذر إنشاء موقع المخزون.");
  await db.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "create", entityType: "inventory_location", entityId: String(locationId), afterData: { branchId: input.branchId, locationCode, locationType: input.locationType } });
  return { locationId, locationCode };
}

export async function listInventoryMovementsForUser(userId: number, branchId?: number) {
  const company = await requireCompanyForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  if (branchId) await requireAccessibleBranchForUser(userId, company.id, branchId);
  const movements = await db.select().from(inventoryMovements).where(eq(inventoryMovements.companyId, company.id)).orderBy(desc(inventoryMovements.occurredAt));
  return branchId ? movements.filter((movement) => movement.branchId === branchId) : movements;
}

export async function createInventoryMovementForUser(input: { userId: number; branchId: number; itemId: number; direction: InventoryDirection; quantity: number; fromLocationId?: number; toLocationId?: number; unitCost?: number; referenceType: string; referenceId: string; occurredAt: Date }) {
  const company = await requireCompanyForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  await requireAccessibleBranchForUser(input.userId, company.id, input.branchId);
  const item = await db.select({ id: items.id, itemType: items.itemType }).from(items).where(and(eq(items.id, input.itemId), eq(items.companyId, company.id), eq(items.isActive, 1))).limit(1);
  if (!item[0]) throw new Error("الصنف المختار غير نشط أو لا يتبع الشركة.");
  if (item[0].itemType === "service") throw new Error("لا يمكن تسجيل حركة مخزون لصنف خدمة.");
  const needsFrom = input.direction === "out" || input.direction === "transfer";
  const needsTo = input.direction === "in" || input.direction === "transfer" || input.direction === "adjustment";
  if (needsFrom && !input.fromLocationId) throw new Error("يلزم تحديد موقع مصدر لهذه الحركة.");
  if (needsTo && !input.toLocationId) throw new Error("يلزم تحديد موقع وجهة لهذه الحركة.");
  if (input.direction === "transfer" && input.fromLocationId === input.toLocationId) throw new Error("لا يمكن التحويل إلى موقع المخزون نفسه.");
  if (input.fromLocationId) await requireAccessibleInventoryLocation(input.userId, company.id, input.branchId, input.fromLocationId);
  if (input.toLocationId) await requireAccessibleInventoryLocation(input.userId, company.id, input.branchId, input.toLocationId);
  const inserted = await db.insert(inventoryMovements).values({ companyId: company.id, branchId: input.branchId, itemId: input.itemId, fromLocationId: input.fromLocationId ?? null, toLocationId: input.toLocationId ?? null, direction: input.direction, quantity: String(input.quantity), unitCost: input.unitCost === undefined ? null : String(input.unitCost), referenceType: input.referenceType.trim(), referenceId: input.referenceId.trim(), occurredAt: input.occurredAt, createdBy: input.userId }).$returningId();
  const movementId = inserted[0]?.id;
  if (!movementId) throw new Error("تعذر تسجيل حركة المخزون.");
  await db.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "create", entityType: "inventory_movement", entityId: String(movementId), afterData: { branchId: input.branchId, itemId: input.itemId, direction: input.direction, quantity: input.quantity, fromLocationId: input.fromLocationId ?? null, toLocationId: input.toLocationId ?? null, referenceType: input.referenceType.trim(), referenceId: input.referenceId.trim(), nonFinancial: true } });
  return { movementId, status: "recorded" as const };
}

export async function createInventoryMovementsFromApprovedDocumentForUser(input: { userId: number; documentId: number; locationId: number; occurredAt: Date }) {
  const company = await requireCompanyForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");

  const document = (await db.select({ id: commercialDocuments.id, branchId: commercialDocuments.branchId, kind: commercialDocuments.kind, status: commercialDocuments.status, documentNumber: commercialDocuments.documentNumber }).from(commercialDocuments).where(and(eq(commercialDocuments.id, input.documentId), eq(commercialDocuments.companyId, company.id))).limit(1))[0];
  if (!document) throw new Error("المستند المصدر غير متاح ضمن نطاق الشركة.");
  if (document.status !== "approved") throw new Error("لا يمكن إنشاء حركة مخزون إلا من مستند معتمد تشغيليًا.");
  if (document.kind !== "sales_invoice" && document.kind !== "purchase_order") throw new Error("تدعم حركة المخزون المصدرية فاتورة المبيعات وأمر الشراء فقط.");
  await requireAccessibleBranchForUser(input.userId, company.id, document.branchId);
  await requireAccessibleInventoryLocation(input.userId, company.id, document.branchId, input.locationId);

  const duplicate = await db.select({ id: inventoryMovements.id }).from(inventoryMovements).where(and(eq(inventoryMovements.companyId, company.id), eq(inventoryMovements.referenceType, "approved_commercial_document"), eq(inventoryMovements.referenceId, String(document.id)))).limit(1);
  if (duplicate[0]) throw new Error("تم بالفعل تسجيل حركة المخزون للمستند المعتمد المحدد.");

  const lines = await db.select({ itemId: commercialDocumentLines.itemId, quantity: commercialDocumentLines.quantity, lineNumber: commercialDocumentLines.lineNumber }).from(commercialDocumentLines).where(eq(commercialDocumentLines.documentId, document.id)).orderBy(commercialDocumentLines.lineNumber);
  const stockLines = lines.filter((line): line is typeof line & { itemId: number } => line.itemId !== null);
  if (!stockLines.length) throw new Error("لا يحتوي المستند المعتمد على بنود أصناف قابلة لحركة المخزون.");
  const stockItems = await Promise.all(stockLines.map(async (line) => (await db.select({ id: items.id, itemType: items.itemType, isActive: items.isActive }).from(items).where(and(eq(items.id, line.itemId), eq(items.companyId, company.id))).limit(1))[0]));
  if (stockItems.some((item) => !item || item.isActive !== 1 || item.itemType === "service")) throw new Error("يحتوي المستند المصدر على صنف غير نشط أو خدمة لا تقبل حركة مخزون.");

  const direction: InventoryDirection = document.kind === "sales_invoice" ? "out" : "in";
  const inserted = await db.transaction(async (tx) => {
    const created = await tx.insert(inventoryMovements).values(stockLines.map((line) => ({
      companyId: company.id,
      branchId: document.branchId,
      itemId: line.itemId,
      fromLocationId: direction === "out" ? input.locationId : null,
      toLocationId: direction === "in" ? input.locationId : null,
      direction,
      quantity: String(line.quantity),
      unitCost: null,
      referenceType: "approved_commercial_document",
      referenceId: String(document.id),
      occurredAt: input.occurredAt,
      createdBy: input.userId,
    } as const))).$returningId();
    await tx.insert(auditEvents).values({
      companyId: company.id,
      actorUserId: input.userId,
      action: "create",
      entityType: "inventory_document_movement",
      entityId: String(document.id),
      afterData: { documentNumber: document.documentNumber, documentKind: document.kind, movementDirection: direction, locationId: input.locationId, movementCount: created.length, sourceStatus: document.status, financialPosting: false },
    });
    return created;
  });
  return { documentId: document.id, movementCount: inserted.length, source: "approved_document" as const, financialPosting: false as const };
}

export async function createStockCountAdjustmentForUser(input: { userId: number; branchId: number; itemId: number; locationId: number; adjustmentKind: "increase" | "decrease"; quantity: number; countReference: string; occurredAt: Date }) {
  const company = await requireCompanyForUser(input.userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  await requireAccessibleBranchForUser(input.userId, company.id, input.branchId);
  await requireAccessibleInventoryLocation(input.userId, company.id, input.branchId, input.locationId);
  const item = (await db.select({ id: items.id, itemType: items.itemType, isActive: items.isActive }).from(items).where(and(eq(items.id, input.itemId), eq(items.companyId, company.id))).limit(1))[0];
  if (!item || item.isActive !== 1 || item.itemType === "service") throw new Error("يجب اختيار صنف مخزني نشط لتسوية الجرد.");
  const countReference = input.countReference.trim().toUpperCase();
  const existing = await db.select({ id: inventoryMovements.id }).from(inventoryMovements).where(and(eq(inventoryMovements.companyId, company.id), eq(inventoryMovements.referenceType, "stock_count_adjustment"), eq(inventoryMovements.referenceId, countReference), eq(inventoryMovements.itemId, input.itemId))).limit(1);
  if (existing[0]) throw new Error("سُجلت بالفعل تسوية لهذا الصنف ضمن مرجع الجرد نفسه.");

  const direction: InventoryDirection = input.adjustmentKind === "increase" ? "adjustment" : "out";
  const inserted = await db.transaction(async (tx) => {
    const result = await tx.insert(inventoryMovements).values({ companyId: company.id, branchId: input.branchId, itemId: input.itemId, fromLocationId: input.adjustmentKind === "decrease" ? input.locationId : null, toLocationId: input.adjustmentKind === "increase" ? input.locationId : null, direction, quantity: String(input.quantity), unitCost: null, referenceType: "stock_count_adjustment", referenceId: countReference, occurredAt: input.occurredAt, createdBy: input.userId }).$returningId();
    const movementId = result[0]?.id;
    if (!movementId) throw new Error("تعذر تسجيل تسوية الجرد.");
    await tx.insert(auditEvents).values({ companyId: company.id, actorUserId: input.userId, action: "create", entityType: "stock_count_adjustment", entityId: String(movementId), afterData: { branchId: input.branchId, itemId: input.itemId, locationId: input.locationId, adjustmentKind: input.adjustmentKind, quantity: input.quantity, countReference, financialPosting: false } });
    return movementId;
  });
  return { movementId: inserted, adjustmentKind: input.adjustmentKind, financialPosting: false as const };
}

export async function listChartOfAccountsForUser(userId: number) {
  const company = await requireCompanyForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.select().from(chartOfAccounts).where(eq(chartOfAccounts.companyId, company.id)).orderBy(chartOfAccounts.accountCode);
}

export async function listAccountingPeriodsForUser(userId: number) {
  const company = await requireCompanyForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  return db.select().from(accountingPeriods).where(eq(accountingPeriods.companyId, company.id)).orderBy(desc(accountingPeriods.startsAt));
}

export async function getOperationalReportSummaryForUser(userId: number) {
  const company = await requireCompanyForUser(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات النظام غير متاحة حاليًا.");
  const [documents, movements, locations, accounts, periods, cashAccountsRows, projectRows, employeeRows, cashDraftRows, auditRows] = await Promise.all([
    db.select({ id: commercialDocuments.id, kind: commercialDocuments.kind, status: commercialDocuments.status, createdAt: commercialDocuments.createdAt }).from(commercialDocuments).where(eq(commercialDocuments.companyId, company.id)),
    db.select({ direction: inventoryMovements.direction, quantity: inventoryMovements.quantity, occurredAt: inventoryMovements.occurredAt }).from(inventoryMovements).where(eq(inventoryMovements.companyId, company.id)),
    db.select({ id: inventoryLocations.id, isActive: inventoryLocations.isActive }).from(inventoryLocations).where(eq(inventoryLocations.companyId, company.id)),
    db.select({ id: chartOfAccounts.id }).from(chartOfAccounts).where(eq(chartOfAccounts.companyId, company.id)),
    db.select({ id: accountingPeriods.id }).from(accountingPeriods).where(eq(accountingPeriods.companyId, company.id)),
    db.select({ id: cashAccounts.id, status: cashAccounts.status }).from(cashAccounts).where(eq(cashAccounts.companyId, company.id)),
    db.select({ id: projects.id, status: projects.status }).from(projects).where(eq(projects.companyId, company.id)),
    db.select({ id: employees.id, status: employees.status }).from(employees).where(eq(employees.companyId, company.id)),
    db.select({ id: cashDrafts.id, draftKind: cashDrafts.draftKind, status: cashDrafts.status }).from(cashDrafts).where(eq(cashDrafts.companyId, company.id)),
    db.select({ action: auditEvents.action, entityType: auditEvents.entityType }).from(auditEvents).where(eq(auditEvents.companyId, company.id)),
  ]);
  const documentStatuses = ["draft", "in_review", "approved", "cancelled"] as const;
  const documentKinds = ["quotation", "sales_invoice", "purchase_request", "purchase_order"] as const;
  const movementDirections = ["in", "out", "transfer", "adjustment"] as const;
  const cashDraftKinds = ["receipt", "payment"] as const;
  const countBy = <T extends string>(values: readonly T[], rows: readonly { [key: string]: unknown }[], key: string) => values.map((value) => ({ key: value, count: rows.filter((row) => row[key] === value).length }));
  const movementByDirection = movementDirections.map((direction) => {
    const rows = movements.filter((movement) => movement.direction === direction);
    return { key: direction, count: rows.length, quantity: rows.reduce((total, movement) => total + Number(movement.quantity), 0) };
  });
  const latestMovementAt = movements.reduce<Date | null>((latest, movement) => !latest || movement.occurredAt > latest ? movement.occurredAt : latest, null);
  const latestDocumentAt = documents.reduce<Date | null>((latest, document) => !latest || document.createdAt > latest ? document.createdAt : latest, null);
  return {
    generatedAt: new Date(),
    commercialDocuments: {
      total: documents.length,
      byStatus: countBy(documentStatuses, documents, "status"),
      byKind: countBy(documentKinds, documents, "kind"),
      latestCreatedAt: latestDocumentAt,
    },
    inventory: {
      locationCount: locations.length,
      activeLocationCount: locations.filter((location) => location.isActive === 1).length,
      movementCount: movements.length,
      byDirection: movementByDirection,
      latestMovementAt,
    },
    operations: {
      activeCashAccountCount: cashAccountsRows.filter((account) => account.status === "active").length,
      activeProjectCount: projectRows.filter((project) => project.status === "active").length,
      activeEmployeeCount: employeeRows.filter((employee) => employee.status === "active").length,
    },
    cashDrafts: {
      total: cashDraftRows.length,
      byKind: countBy(cashDraftKinds, cashDraftRows, "draftKind"),
      nonPostedCount: cashDraftRows.filter((draft) => draft.status === "draft").length,
    },
    governance: {
      auditEventCount: auditRows.length,
      operationalDecisionCount: auditRows.filter((event) => event.entityType === "commercial_document" && (event.action === "approve" || event.action === "cancel")).length,
      printEvidenceCount: auditRows.filter((event) => event.action === "export").length,
      financialApprovalAvailable: false as const,
    },
    accountingReadiness: { chartOfAccountsCount: accounts.length, accountingPeriodCount: periods.length, formalStatementsAvailable: false as const },
  };
}

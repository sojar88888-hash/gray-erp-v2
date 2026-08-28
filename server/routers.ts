import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { canPostFinancialEntries, ERP_ROLES, financialReadiness, hasPermission, permissionsForRole, validateCompanySetup } from "./erp";
import { createBranchForUser, createCashAccountForUser, createCashDraftForUser, createCommercialDraftForUser, createCustomerForUser, createEmployeeForUser, createFixedAssetForUser, createInitialCompany, createInventoryLocationForUser, createInventoryMovementForUser, createInventoryMovementsFromApprovedDocumentForUser, createItemForUser, createProjectForUser, createStockCountAdjustmentForUser, createSupplierForUser, getCompanySetupForUser, getOperationalReportSummaryForUser, getPrintableCommercialDocumentForUser, listAccountingPeriodsForUser, listAuditEventsForUser, listBranchesForUser, listCashAccountsForUser, listCashDraftsForUser, listChartOfAccountsForUser, listCommercialDocumentsForUser, listCompanySettingsForUser, listCompanyUsersForAdmin, listCustomersForUser, listEmployeesForUser, listFixedAssetsForUser, listInventoryLocationsForUser, listInventoryMovementsForUser, listItemsForUser, listProjectsForUser, listSuppliersForUser, recordCashDraftPrintForUser, recordCommercialDocumentPrintForUser, updateCommercialDocumentStatusForUser, updateCompanyUserRoleForAdmin, upsertCompanySettingForUser } from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  erp: router({
    accessModel: publicProcedure.query(() => ({
      roles: ERP_ROLES,
      nonProductionAccountingBoundary: true,
    })),
    myPermissions: protectedProcedure.query(({ ctx }) => ({
      role: ctx.user.role,
      permissions: permissionsForRole(ctx.user.role),
    })),
    may: protectedProcedure
      .input(z.object({ permission: z.enum(["dashboard.read", "sales.create", "purchases.create", "inventory.create", "accounting.read", "accounting.post", "reports.read", "administration.manage", "audit.read"]) }))
      .query(({ ctx, input }) => ({ allowed: hasPermission(ctx.user.role, input.permission) })),
    financial: router({
      readiness: publicProcedure.query(() => financialReadiness()),
      postingStatus: protectedProcedure.query(({ ctx }) => canPostFinancialEntries(ctx.user.role)),
      postJournalEntry: protectedProcedure
        .input(z.object({ journalEntryId: z.number().int().positive() }))
        .mutation(({ ctx }) => {
          if (!hasPermission(ctx.user.role, "accounting.post")) {
            throw new Error("لا تملك صلاحية ترحيل القيود المالية.");
          }
          const readiness = financialReadiness();
          if (!readiness.ready) {
            throw new Error(readiness.reason);
          }
          throw new Error("لم تُفعّل خدمة ترحيل القيود في هذه البيئة.");
        }),
      issueFinancialStatement: protectedProcedure
        .input(z.object({ statementType: z.enum(["income_statement", "balance_sheet", "cash_flow"]), periodCode: z.string().min(1).max(16) }))
        .mutation(({ ctx }) => {
          if (!hasPermission(ctx.user.role, "reports.read")) {
            throw new Error("لا تملك صلاحية إصدار التقارير المالية.");
          }
          const readiness = financialReadiness();
          if (!readiness.ready) {
            throw new Error(readiness.reason);
          }
          throw new Error("لم تُفعّل خدمة إصدار القوائم المالية في هذه البيئة.");
        }),
    }),
    setup: router({
      status: protectedProcedure.query(async ({ ctx }) => (await getCompanySetupForUser(ctx.user.id)) ?? null),
      createInitialCompany: protectedProcedure
        .input(z.object({
          legalName: z.string().min(3).max(255),
          companyCode: z.string().min(2).max(32),
          baseCurrency: z.string().length(3),
          timeZone: z.string().min(1).max(64),
        }))
        .mutation(async ({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "administration.manage")) {
            throw new Error("لا تملك صلاحية تهيئة الشركة.");
          }
          const company = validateCompanySetup(input);
          return createInitialCompany({ ...company, actorUserId: ctx.user.id });
      }),
    }),
    settings: router({
      list: protectedProcedure.query(({ ctx }) => {
        if (!hasPermission(ctx.user.role, "administration.manage")) throw new Error("لا تملك صلاحية عرض إعدادات الشركة.");
        return listCompanySettingsForUser(ctx.user.id);
      }),
      upsertOperationalPolicy: protectedProcedure
        .input(z.object({
          defaultDocumentCurrency: z.string().regex(/^[A-Za-z]{3}$/),
          approvalMode: z.enum(["controlled", "manual_review"]),
          notificationDigestEnabled: z.boolean(),
        }))
        .mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "administration.manage")) throw new Error("لا تملك صلاحية تحديث إعدادات الشركة.");
          return upsertCompanySettingForUser({
            userId: ctx.user.id,
            settingKey: "operational_policy",
            settingValue: { ...input, defaultDocumentCurrency: input.defaultDocumentCurrency.toUpperCase() },
          });
      }),
    }),
    organization: router({
      branches: router({
        list: protectedProcedure.query(({ ctx }) => {
          if (!hasPermission(ctx.user.role, "sales.create") && !hasPermission(ctx.user.role, "purchases.create") && !hasPermission(ctx.user.role, "administration.manage")) throw new Error("لا تملك صلاحية عرض الفروع التشغيلية.");
          return listBranchesForUser(ctx.user.id);
        }),
        create: protectedProcedure.input(z.object({ branchCode: z.string().regex(/^[A-Za-z0-9_-]{2,32}$/), name: z.string().min(2).max(160) })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "administration.manage")) throw new Error("لا تملك صلاحية إنشاء فرع.");
          return createBranchForUser({ ...input, userId: ctx.user.id });
        }),
      }),
    }),
    userManagement: router({
      list: protectedProcedure.query(({ ctx }) => {
        if (!hasPermission(ctx.user.role, "administration.manage")) throw new Error("لا تملك صلاحية عرض مستخدمي الشركة.");
        return listCompanyUsersForAdmin(ctx.user.id);
      }),
      updateRole: protectedProcedure.input(z.object({ targetUserId: z.number().int().positive(), role: z.enum(["admin", "manager", "accountant", "user"]) })).mutation(({ ctx, input }) => {
        if (!hasPermission(ctx.user.role, "administration.manage")) throw new Error("لا تملك صلاحية تحديث أدوار المستخدمين.");
        return updateCompanyUserRoleForAdmin({ actorUserId: ctx.user.id, ...input });
      }),
    }),
    documents: router({
      items: router({
        list: protectedProcedure.query(({ ctx }) => {
          if (!hasPermission(ctx.user.role, "sales.create") && !hasPermission(ctx.user.role, "purchases.create") && !hasPermission(ctx.user.role, "inventory.create")) {
            throw new Error("لا تملك صلاحية عرض أصناف المستندات التجارية.");
          }
          return listItemsForUser(ctx.user.id);
        }),
      }),
      sales: router({
        list: protectedProcedure.query(({ ctx }) => {
          if (!hasPermission(ctx.user.role, "sales.create")) throw new Error("لا تملك صلاحية عرض مستندات المبيعات.");
          return listCommercialDocumentsForUser(ctx.user.id, ["quotation", "sales_invoice"]);
        }),
        getPrintable: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).query(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "sales.create")) throw new Error("لا تملك صلاحية طباعة مستندات المبيعات.");
          return getPrintableCommercialDocumentForUser({ ...input, userId: ctx.user.id, allowedKinds: ["quotation", "sales_invoice"] });
        }),
        recordPrint: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "sales.create")) throw new Error("لا تملك صلاحية طباعة مستندات المبيعات.");
          return recordCommercialDocumentPrintForUser({ ...input, userId: ctx.user.id, allowedKinds: ["quotation", "sales_invoice"] });
        }),
        createDraft: protectedProcedure.input(z.object({
          branchId: z.number().int().positive(), kind: z.enum(["quotation", "sales_invoice"]), documentNumber: z.string().regex(/^[A-Za-z0-9_-]{2,64}$/), customerId: z.number().int().positive(), documentDate: z.coerce.date(), dueDate: z.coerce.date().optional(), currency: z.string().regex(/^[A-Za-z]{3}$/), notes: z.string().max(4000).optional(),
          lines: z.array(z.object({ itemId: z.number().int().positive().optional(), description: z.string().min(2).max(500), quantity: z.number().positive().max(999999999), unitPrice: z.number().min(0).max(999999999), taxRate: z.number().min(0).max(100) })).min(1).max(200),
        })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "sales.create")) throw new Error("لا تملك صلاحية إنشاء مسودة مبيعات.");
          return createCommercialDraftForUser({ ...input, userId: ctx.user.id });
        }),
        updateStatus: protectedProcedure.input(z.object({ documentId: z.number().int().positive(), nextStatus: z.enum(["in_review", "approved", "cancelled"]), reason: z.string().min(2).max(500).optional() })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "sales.create")) throw new Error("لا تملك صلاحية تشغيل مستندات المبيعات.");
          if (input.nextStatus === "approved" && !hasPermission(ctx.user.role, "documents.review")) throw new Error("لا تملك صلاحية اتخاذ القرار التشغيلي النهائي على المستند.");
          return updateCommercialDocumentStatusForUser({ ...input, userId: ctx.user.id, allowedKinds: ["quotation", "sales_invoice"] });
        }),
      }),
      purchases: router({
        list: protectedProcedure.query(({ ctx }) => {
          if (!hasPermission(ctx.user.role, "purchases.create")) throw new Error("لا تملك صلاحية عرض مستندات المشتريات.");
          return listCommercialDocumentsForUser(ctx.user.id, ["purchase_request", "purchase_order"]);
        }),
        getPrintable: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).query(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "purchases.create")) throw new Error("لا تملك صلاحية طباعة مستندات المشتريات.");
          return getPrintableCommercialDocumentForUser({ ...input, userId: ctx.user.id, allowedKinds: ["purchase_request", "purchase_order"] });
        }),
        recordPrint: protectedProcedure.input(z.object({ documentId: z.number().int().positive() })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "purchases.create")) throw new Error("لا تملك صلاحية طباعة مستندات المشتريات.");
          return recordCommercialDocumentPrintForUser({ ...input, userId: ctx.user.id, allowedKinds: ["purchase_request", "purchase_order"] });
        }),
        createDraft: protectedProcedure.input(z.object({
          branchId: z.number().int().positive(), kind: z.enum(["purchase_request", "purchase_order"]), documentNumber: z.string().regex(/^[A-Za-z0-9_-]{2,64}$/), supplierId: z.number().int().positive(), documentDate: z.coerce.date(), dueDate: z.coerce.date().optional(), currency: z.string().regex(/^[A-Za-z]{3}$/), notes: z.string().max(4000).optional(),
          lines: z.array(z.object({ itemId: z.number().int().positive().optional(), description: z.string().min(2).max(500), quantity: z.number().positive().max(999999999), unitPrice: z.number().min(0).max(999999999), taxRate: z.number().min(0).max(100) })).min(1).max(200),
        })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "purchases.create")) throw new Error("لا تملك صلاحية إنشاء مسودة مشتريات.");
          return createCommercialDraftForUser({ ...input, userId: ctx.user.id });
        }),
        updateStatus: protectedProcedure.input(z.object({ documentId: z.number().int().positive(), nextStatus: z.enum(["in_review", "approved", "cancelled"]), reason: z.string().min(2).max(500).optional() })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "purchases.create")) throw new Error("لا تملك صلاحية تشغيل مستندات المشتريات.");
          if (input.nextStatus === "approved" && !hasPermission(ctx.user.role, "documents.review")) throw new Error("لا تملك صلاحية اتخاذ القرار التشغيلي النهائي على المستند.");
          return updateCommercialDocumentStatusForUser({ ...input, userId: ctx.user.id, allowedKinds: ["purchase_request", "purchase_order"] });
        }),
      }),
    }),
    accountingRegistry: router({
      chartOfAccounts: protectedProcedure.query(({ ctx }) => {
        if (!hasPermission(ctx.user.role, "accounting.read")) throw new Error("لا تملك صلاحية عرض دليل الحسابات.");
        return listChartOfAccountsForUser(ctx.user.id);
      }),
      periods: protectedProcedure.query(({ ctx }) => {
        if (!hasPermission(ctx.user.role, "accounting.read")) throw new Error("لا تملك صلاحية عرض الفترات المحاسبية.");
        return listAccountingPeriodsForUser(ctx.user.id);
      }),
    }),
    reports: router({
      operationalSummary: protectedProcedure.query(({ ctx }) => {
        if (!hasPermission(ctx.user.role, "reports.read")) throw new Error("لا تملك صلاحية عرض ملخص التقارير التشغيلية.");
        return getOperationalReportSummaryForUser(ctx.user.id);
      }),
    }),
    inventory: router({
      locations: router({
        list: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "inventory.create")) throw new Error("لا تملك صلاحية عرض مواقع المخزون.");
          return listInventoryLocationsForUser(ctx.user.id, input?.branchId);
        }),
        create: protectedProcedure.input(z.object({ branchId: z.number().int().positive(), locationCode: z.string().regex(/^[A-Za-z0-9_-]{2,48}$/), name: z.string().min(2).max(160), locationType: z.enum(["warehouse", "ground_tank", "tanker"]), capacity: z.number().positive().max(999999999).optional() })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "inventory.create")) throw new Error("لا تملك صلاحية إدارة مواقع المخزون.");
          return createInventoryLocationForUser({ ...input, userId: ctx.user.id });
        }),
      }),
      movements: router({
        list: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "inventory.create")) throw new Error("لا تملك صلاحية عرض حركات المخزون.");
          return listInventoryMovementsForUser(ctx.user.id, input?.branchId);
        }),
        create: protectedProcedure.input(z.object({
          branchId: z.number().int().positive(),
          itemId: z.number().int().positive(),
          direction: z.literal("transfer"),
          quantity: z.number().positive().max(999999999),
          fromLocationId: z.number().int().positive().optional(),
          toLocationId: z.number().int().positive().optional(),
          unitCost: z.number().min(0).max(999999999).optional(),
          referenceType: z.string().min(2).max(64),
          referenceId: z.string().min(1).max(96),
          occurredAt: z.coerce.date(),
        })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "inventory.create")) throw new Error("لا تملك صلاحية تسجيل حركة مخزون.");
          return createInventoryMovementForUser({ ...input, userId: ctx.user.id });
        }),
        fromApprovedDocument: protectedProcedure.input(z.object({ documentId: z.number().int().positive(), locationId: z.number().int().positive(), occurredAt: z.coerce.date() })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "inventory.create")) throw new Error("لا تملك صلاحية إنشاء حركة مخزون من مستند معتمد.");
          return createInventoryMovementsFromApprovedDocumentForUser({ ...input, userId: ctx.user.id });
        }),
        stockCountAdjustment: protectedProcedure.input(z.object({ branchId: z.number().int().positive(), itemId: z.number().int().positive(), locationId: z.number().int().positive(), adjustmentKind: z.enum(["increase", "decrease"]), quantity: z.number().positive().max(999999999), countReference: z.string().min(3).max(96), occurredAt: z.coerce.date() })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "inventory.create")) throw new Error("لا تملك صلاحية تسجيل تسوية جرد.");
          return createStockCountAdjustmentForUser({ ...input, userId: ctx.user.id });
        }),
      }),
    }),
    cash: router({
      drafts: router({
        list: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "accounting.read")) throw new Error("لا تملك صلاحية عرض مسودات القبض والصرف.");
          return listCashDraftsForUser(ctx.user.id, input?.branchId);
        }),
        create: protectedProcedure.input(z.object({
          branchId: z.number().int().positive(),
          cashAccountId: z.number().int().positive(),
          voucherNumber: z.string().regex(/^[A-Za-z0-9_-]{2,64}$/),
          draftKind: z.enum(["receipt", "payment"]),
          counterpartyType: z.enum(["customer", "supplier", "other"]),
          customerId: z.number().int().positive().optional(),
          supplierId: z.number().int().positive().optional(),
          counterpartyName: z.string().min(2).max(255).optional(),
          amount: z.number().positive().max(999999999),
          currency: z.string().regex(/^[A-Za-z]{3}$/),
          transactionDate: z.coerce.date(),
          narrative: z.string().min(2).max(1000),
        }).superRefine((data, context) => {
          if (data.counterpartyType === "customer" && (!data.customerId || data.supplierId || data.counterpartyName)) context.addIssue({ code: z.ZodIssueCode.custom, message: "يلزم اختيار عميل فقط لهذه المسودة." });
          if (data.counterpartyType === "supplier" && (!data.supplierId || data.customerId || data.counterpartyName)) context.addIssue({ code: z.ZodIssueCode.custom, message: "يلزم اختيار مورد فقط لهذه المسودة." });
          if (data.counterpartyType === "other" && (!data.counterpartyName || data.customerId || data.supplierId)) context.addIssue({ code: z.ZodIssueCode.custom, message: "يلزم اسم طرف آخر دون ربط عميل أو مورد." });
        })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "accounting.read")) throw new Error("لا تملك صلاحية إنشاء مسودة قبض أو صرف.");
          return createCashDraftForUser({ ...input, userId: ctx.user.id, currency: input.currency.toUpperCase() });
        }),
        recordPrint: protectedProcedure.input(z.object({ cashDraftId: z.number().int().positive() })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "accounting.read")) throw new Error("لا تملك صلاحية طباعة مسودة قبض أو صرف.");
          return recordCashDraftPrintForUser({ userId: ctx.user.id, cashDraftId: input.cashDraftId });
        }),
      }),
    }),
    masterData: router({
      customers: router({
        list: protectedProcedure.query(({ ctx }) => {
          if (!hasPermission(ctx.user.role, "sales.create") && !hasPermission(ctx.user.role, "accounting.read")) throw new Error("لا تملك صلاحية عرض العملاء.");
          return listCustomersForUser(ctx.user.id);
        }),
        create: protectedProcedure.input(z.object({ customerCode: z.string().regex(/^[A-Za-z0-9_-]{2,40}$/), legalName: z.string().min(3).max(255), taxNumber: z.string().max(64).optional(), phone: z.string().max(48).optional(), email: z.string().email().max(320).optional() })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "sales.create")) throw new Error("لا تملك صلاحية إنشاء عميل.");
          return createCustomerForUser({ ...input, userId: ctx.user.id });
        }),
      }),
      suppliers: router({
        list: protectedProcedure.query(({ ctx }) => {
          if (!hasPermission(ctx.user.role, "purchases.create") && !hasPermission(ctx.user.role, "accounting.read")) throw new Error("لا تملك صلاحية عرض الموردين.");
          return listSuppliersForUser(ctx.user.id);
        }),
        create: protectedProcedure.input(z.object({ supplierCode: z.string().regex(/^[A-Za-z0-9_-]{2,40}$/), legalName: z.string().min(3).max(255), taxNumber: z.string().max(64).optional(), phone: z.string().max(48).optional(), email: z.string().email().max(320).optional() })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "purchases.create")) throw new Error("لا تملك صلاحية إنشاء مورد.");
          return createSupplierForUser({ ...input, userId: ctx.user.id });
        }),
      }),
      items: router({
        list: protectedProcedure.query(({ ctx }) => {
          if (!hasPermission(ctx.user.role, "inventory.create")) throw new Error("لا تملك صلاحية عرض الأصناف.");
          return listItemsForUser(ctx.user.id);
        }),
        create: protectedProcedure.input(z.object({ itemCode: z.string().regex(/^[A-Za-z0-9_-]{2,64}$/), name: z.string().min(2).max(255), itemType: z.enum(["inventory", "fuel", "service"]), unitOfMeasure: z.string().min(1).max(32) })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "inventory.create")) throw new Error("لا تملك صلاحية إنشاء صنف.");
          return createItemForUser({ ...input, userId: ctx.user.id });
        }),
      }),
      cashAccounts: router({
        list: protectedProcedure.query(({ ctx }) => {
          if (!hasPermission(ctx.user.role, "accounting.read")) throw new Error("لا تملك صلاحية عرض حسابات النقد والبنوك.");
          return listCashAccountsForUser(ctx.user.id);
        }),
        create: protectedProcedure.input(z.object({ accountCode: z.string().regex(/^[A-Za-z0-9_-]{2,40}$/), name: z.string().min(2).max(160), accountKind: z.enum(["bank", "cash_box"]), currency: z.string().regex(/^[A-Za-z]{3}$/), bankName: z.string().max(160).optional(), accountReference: z.string().max(96).optional() })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "accounting.read")) throw new Error("لا تملك صلاحية إدارة حسابات النقد والبنوك.");
          return createCashAccountForUser({ ...input, userId: ctx.user.id });
        }),
      }),
      projects: router({
        list: protectedProcedure.query(({ ctx }) => {
          if (!hasPermission(ctx.user.role, "administration.manage")) throw new Error("لا تملك صلاحية عرض المشاريع.");
          return listProjectsForUser(ctx.user.id);
        }),
        create: protectedProcedure.input(z.object({ projectCode: z.string().regex(/^[A-Za-z0-9_-]{2,40}$/), name: z.string().min(2).max(255), startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional() }).refine((data) => !data.startsAt || !data.endsAt || data.endsAt >= data.startsAt, { message: "يجب ألا يسبق تاريخ انتهاء المشروع تاريخ بدايته." })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "administration.manage")) throw new Error("لا تملك صلاحية إنشاء المشاريع.");
          return createProjectForUser({ ...input, userId: ctx.user.id });
        }),
      }),
      fixedAssets: router({
        list: protectedProcedure.query(({ ctx }) => {
          if (!hasPermission(ctx.user.role, "administration.manage")) throw new Error("لا تملك صلاحية عرض الأصول الثابتة.");
          return listFixedAssetsForUser(ctx.user.id);
        }),
        create: protectedProcedure.input(z.object({ assetCode: z.string().regex(/^[A-Za-z0-9_-]{2,48}$/), name: z.string().min(2).max(255), category: z.string().min(2).max(160), serialNumber: z.string().max(128).optional(), locationDescription: z.string().max(255).optional() })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "administration.manage")) throw new Error("لا تملك صلاحية إنشاء سجل أصل ثابت.");
          return createFixedAssetForUser({ ...input, userId: ctx.user.id });
        }),
      }),
      employees: router({
        list: protectedProcedure.query(({ ctx }) => {
          if (!hasPermission(ctx.user.role, "administration.manage")) throw new Error("لا تملك صلاحية عرض سجلات الموارد البشرية.");
          return listEmployeesForUser(ctx.user.id);
        }),
        create: protectedProcedure.input(z.object({ employeeCode: z.string().regex(/^[A-Za-z0-9_-]{2,40}$/), fullName: z.string().min(3).max(255), department: z.string().max(160).optional(), jobTitle: z.string().max(160).optional(), workEmail: z.string().email().max(320).optional() })).mutation(({ ctx, input }) => {
          if (!hasPermission(ctx.user.role, "administration.manage")) throw new Error("لا تملك صلاحية إنشاء سجل موظف.");
          return createEmployeeForUser({ ...input, userId: ctx.user.id });
        }),
      }),
    }),
    audit: router({
      list: protectedProcedure.query(({ ctx }) => {
        if (!hasPermission(ctx.user.role, "audit.read")) throw new Error("لا تملك صلاحية عرض سجل التدقيق.");
        return listAuditEventsForUser(ctx.user.id);
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;

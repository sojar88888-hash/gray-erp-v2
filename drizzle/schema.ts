import {
  bigint,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const auditAction = mysqlEnum("auditAction", ["create", "update", "cancel", "approve", "export", "login"]);
const documentStatus = mysqlEnum("documentStatus", ["draft", "in_review", "approved", "cancelled"]);
const documentKind = mysqlEnum("documentKind", ["quotation", "sales_order", "sales_invoice", "purchase_request", "purchase_order", "supplier_invoice"]);
const stockDirection = mysqlEnum("stockDirection", ["in", "out", "transfer", "adjustment"]);

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "manager", "accountant", "user"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  legalName: varchar("legalName", { length: 255 }).notNull(),
  companyCode: varchar("companyCode", { length: 32 }).notNull().unique(),
  baseCurrency: varchar("baseCurrency", { length: 3 }).notNull().default("SAR"),
  timeZone: varchar("timeZone", { length: 64 }).notNull().default("Asia/Riyadh"),
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const branches = mysqlTable("branches", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  branchCode: varchar("branchCode", { length: 32 }).notNull(),
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("branches_company_code_unique").on(table.companyId, table.branchCode)]);

export const userScopes = mysqlTable("userScopes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  companyId: int("companyId").notNull(),
  branchId: int("branchId"),
  dataScope: mysqlEnum("dataScope", ["company", "branch", "assigned"]).notNull().default("assigned"),
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("user_scopes_user_company_branch_unique").on(table.userId, table.companyId, table.branchId)]);

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  customerCode: varchar("customerCode", { length: 40 }).notNull(),
  legalName: varchar("legalName", { length: 255 }).notNull(),
  taxNumber: varchar("taxNumber", { length: 64 }),
  contactName: varchar("contactName", { length: 160 }),
  phone: varchar("phone", { length: 48 }),
  email: varchar("email", { length: 320 }),
  creditLimit: decimal("creditLimit", { precision: 18, scale: 2 }).notNull().default("0"),
  status: mysqlEnum("customerStatus", ["active", "inactive", "blocked"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("customers_company_code_unique").on(table.companyId, table.customerCode)]);

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  supplierCode: varchar("supplierCode", { length: 40 }).notNull(),
  legalName: varchar("legalName", { length: 255 }).notNull(),
  taxNumber: varchar("taxNumber", { length: 64 }),
  contactName: varchar("contactName", { length: 160 }),
  phone: varchar("phone", { length: 48 }),
  email: varchar("email", { length: 320 }),
  status: mysqlEnum("supplierStatus", ["active", "inactive", "blocked"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("suppliers_company_code_unique").on(table.companyId, table.supplierCode)]);

export const items = mysqlTable("items", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  itemCode: varchar("itemCode", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  itemType: mysqlEnum("itemType", ["inventory", "fuel", "service"]).notNull(),
  unitOfMeasure: varchar("unitOfMeasure", { length: 32 }).notNull(),
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("items_company_code_unique").on(table.companyId, table.itemCode)]);

export const inventoryLocations = mysqlTable("inventoryLocations", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  branchId: int("branchId").notNull(),
  locationCode: varchar("locationCode", { length: 48 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  locationType: mysqlEnum("locationType", ["warehouse", "ground_tank", "tanker"]).notNull(),
  capacity: decimal("capacity", { precision: 18, scale: 3 }),
  isActive: int("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("locations_company_code_unique").on(table.companyId, table.locationCode)]);

export const commercialDocuments = mysqlTable("commercialDocuments", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  branchId: int("branchId").notNull(),
  kind: documentKind.notNull(),
  status: documentStatus.notNull().default("draft"),
  documentNumber: varchar("documentNumber", { length: 64 }).notNull(),
  customerId: int("customerId"),
  supplierId: int("supplierId"),
  documentDate: timestamp("documentDate").notNull(),
  dueDate: timestamp("dueDate"),
  currency: varchar("currency", { length: 3 }).notNull().default("SAR"),
  subtotal: decimal("subtotal", { precision: 18, scale: 2 }).notNull().default("0"),
  taxAmount: decimal("taxAmount", { precision: 18, scale: 2 }).notNull().default("0"),
  totalAmount: decimal("totalAmount", { precision: 18, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("commercial_documents_company_number_unique").on(table.companyId, table.documentNumber),
  index("commercial_documents_company_kind_status_idx").on(table.companyId, table.kind, table.status),
]);

export const commercialDocumentLines = mysqlTable("commercialDocumentLines", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  documentId: bigint("documentId", { mode: "number" }).notNull(),
  lineNumber: int("lineNumber").notNull(),
  itemId: int("itemId"),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 3 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 18, scale: 4 }).notNull().default("0"),
  taxRate: decimal("taxRate", { precision: 7, scale: 4 }).notNull().default("0"),
  lineTotal: decimal("lineTotal", { precision: 18, scale: 2 }).notNull().default("0"),
}, (table) => [uniqueIndex("commercial_document_lines_document_line_unique").on(table.documentId, table.lineNumber)]);

export const inventoryMovements = mysqlTable("inventoryMovements", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  branchId: int("branchId").notNull(),
  itemId: int("itemId").notNull(),
  fromLocationId: int("fromLocationId"),
  toLocationId: int("toLocationId"),
  direction: stockDirection.notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 3 }).notNull(),
  unitCost: decimal("unitCost", { precision: 18, scale: 4 }),
  referenceType: varchar("referenceType", { length: 48 }).notNull(),
  referenceId: varchar("referenceId", { length: 64 }).notNull(),
  occurredAt: timestamp("occurredAt").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("inventory_movements_item_time_idx").on(table.companyId, table.itemId, table.occurredAt)]);

export const chartOfAccounts = mysqlTable("chartOfAccounts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  accountCode: varchar("accountCode", { length: 32 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  accountType: mysqlEnum("accountType", ["asset", "liability", "equity", "revenue", "expense"]).notNull(),
  isPostingAllowed: int("isPostingAllowed").notNull().default(0),
  isActive: int("isActive").notNull().default(1),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("coa_company_code_unique").on(table.companyId, table.accountCode)]);

export const accountingPeriods = mysqlTable("accountingPeriods", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  periodCode: varchar("periodCode", { length: 16 }).notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  status: mysqlEnum("periodStatus", ["open", "closing", "closed"]).notNull().default("open"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("accounting_periods_company_code_unique").on(table.companyId, table.periodCode)]);

export const journalEntries = mysqlTable("journalEntries", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  periodId: int("periodId").notNull(),
  entryNumber: varchar("entryNumber", { length: 64 }).notNull(),
  sourceType: varchar("sourceType", { length: 48 }).notNull(),
  sourceId: varchar("sourceId", { length: 64 }).notNull(),
  status: mysqlEnum("journalStatus", ["draft", "approved", "posted", "reversed"]).notNull().default("draft"),
  occurredAt: timestamp("occurredAt").notNull(),
  createdBy: int("createdBy").notNull(),
  approvedBy: int("approvedBy"),
  postedBy: int("postedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("journals_company_number_unique").on(table.companyId, table.entryNumber)]);

export const journalLines = mysqlTable("journalLines", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  journalEntryId: bigint("journalEntryId", { mode: "number" }).notNull(),
  lineNumber: int("lineNumber").notNull(),
  accountId: int("accountId").notNull(),
  debit: decimal("debit", { precision: 18, scale: 2 }).notNull().default("0"),
  credit: decimal("credit", { precision: 18, scale: 2 }).notNull().default("0"),
  narration: varchar("narration", { length: 500 }),
}, (table) => [uniqueIndex("journal_lines_entry_line_unique").on(table.journalEntryId, table.lineNumber)]);

export const cashAccounts = mysqlTable("cashAccounts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  accountCode: varchar("accountCode", { length: 40 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  accountKind: mysqlEnum("cashAccountKind", ["bank", "cash_box"]).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  bankName: varchar("bankName", { length: 160 }),
  accountReference: varchar("accountReference", { length: 96 }),
  status: mysqlEnum("cashAccountStatus", ["active", "inactive", "blocked"]).notNull().default("active"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("cash_accounts_company_code_unique").on(table.companyId, table.accountCode)]);

export const cashDrafts = mysqlTable("cashDrafts", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  branchId: int("branchId").notNull(),
  cashAccountId: int("cashAccountId").notNull(),
  voucherNumber: varchar("voucherNumber", { length: 64 }).notNull(),
  draftKind: mysqlEnum("cashDraftKind", ["receipt", "payment"]).notNull(),
  counterpartyType: mysqlEnum("cashDraftCounterpartyType", ["customer", "supplier", "other"]).notNull(),
  customerId: int("customerId"),
  supplierId: int("supplierId"),
  counterpartyName: varchar("counterpartyName", { length: 255 }),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  transactionDate: timestamp("transactionDate").notNull(),
  narrative: varchar("narrative", { length: 1000 }).notNull(),
  status: mysqlEnum("cashDraftStatus", ["draft", "in_review", "cancelled", "blocked_pending_authority"]).notNull().default("draft"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("cash_drafts_company_voucher_unique").on(table.companyId, table.voucherNumber)]);

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  projectCode: varchar("projectCode", { length: 40 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  customerId: int("customerId"),
  managerUserId: int("managerUserId"),
  status: mysqlEnum("projectStatus", ["draft", "active", "on_hold", "completed", "closed"]).notNull().default("draft"),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("projects_company_code_unique").on(table.companyId, table.projectCode)]);

export const fixedAssets = mysqlTable("fixedAssets", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  assetCode: varchar("assetCode", { length: 48 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 160 }).notNull(),
  serialNumber: varchar("serialNumber", { length: 128 }),
  acquiredAt: timestamp("acquiredAt"),
  locationDescription: varchar("locationDescription", { length: 255 }),
  status: mysqlEnum("assetStatus", ["planned", "active", "under_maintenance", "disposed"]).notNull().default("planned"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("fixed_assets_company_code_unique").on(table.companyId, table.assetCode)]);

export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeCode: varchar("employeeCode", { length: 40 }).notNull(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  department: varchar("department", { length: 160 }),
  jobTitle: varchar("jobTitle", { length: 160 }),
  workEmail: varchar("workEmail", { length: 320 }),
  status: mysqlEnum("employeeStatus", ["active", "on_leave", "inactive"]).notNull().default("active"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("employees_company_code_unique").on(table.companyId, table.employeeCode)]);

export const companySettings = mysqlTable("companySettings", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  settingKey: varchar("settingKey", { length: 96 }).notNull(),
  settingValue: json("settingValue").notNull(),
  updatedBy: int("updatedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("company_settings_company_key_unique").on(table.companyId, table.settingKey)]);

export const auditEvents = mysqlTable("auditEvents", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  actorUserId: int("actorUserId"),
  action: auditAction.notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  requestId: varchar("requestId", { length: 64 }),
  beforeData: json("beforeData"),
  afterData: json("afterData"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, (table) => [index("audit_events_company_entity_time_idx").on(table.companyId, table.entityType, table.entityId, table.occurredAt)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

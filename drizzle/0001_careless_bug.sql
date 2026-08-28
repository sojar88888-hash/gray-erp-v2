CREATE TABLE `accountingPeriods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`periodCode` varchar(16) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`periodStatus` enum('open','closing','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accountingPeriods_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounting_periods_company_code_unique` UNIQUE(`companyId`,`periodCode`)
);
--> statement-breakpoint
CREATE TABLE `auditEvents` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`actorUserId` int,
	`auditAction` enum('create','update','cancel','approve','export','login') NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` varchar(64) NOT NULL,
	`requestId` varchar(64),
	`beforeData` json,
	`afterData` json,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`branchCode` varchar(32) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `branches_id` PRIMARY KEY(`id`),
	CONSTRAINT `branches_company_code_unique` UNIQUE(`companyId`,`branchCode`)
);
--> statement-breakpoint
CREATE TABLE `chartOfAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`accountCode` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`accountType` enum('asset','liability','equity','revenue','expense') NOT NULL,
	`isPostingAllowed` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`effectiveFrom` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chartOfAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `coa_company_code_unique` UNIQUE(`companyId`,`accountCode`)
);
--> statement-breakpoint
CREATE TABLE `commercialDocumentLines` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`documentId` bigint NOT NULL,
	`lineNumber` int NOT NULL,
	`itemId` int,
	`description` varchar(500) NOT NULL,
	`quantity` decimal(18,3) NOT NULL,
	`unitPrice` decimal(18,4) NOT NULL DEFAULT '0',
	`taxRate` decimal(7,4) NOT NULL DEFAULT '0',
	`lineTotal` decimal(18,2) NOT NULL DEFAULT '0',
	CONSTRAINT `commercialDocumentLines_id` PRIMARY KEY(`id`),
	CONSTRAINT `commercial_document_lines_document_line_unique` UNIQUE(`documentId`,`lineNumber`)
);
--> statement-breakpoint
CREATE TABLE `commercialDocuments` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`branchId` int NOT NULL,
	`documentKind` enum('quotation','sales_order','sales_invoice','purchase_request','purchase_order','supplier_invoice') NOT NULL,
	`documentStatus` enum('draft','in_review','approved','cancelled') NOT NULL DEFAULT 'draft',
	`documentNumber` varchar(64) NOT NULL,
	`customerId` int,
	`supplierId` int,
	`documentDate` timestamp NOT NULL,
	`dueDate` timestamp,
	`currency` varchar(3) NOT NULL DEFAULT 'SAR',
	`subtotal` decimal(18,2) NOT NULL DEFAULT '0',
	`taxAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`totalAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commercialDocuments_id` PRIMARY KEY(`id`),
	CONSTRAINT `commercial_documents_company_number_unique` UNIQUE(`companyId`,`documentNumber`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`legalName` varchar(255) NOT NULL,
	`companyCode` varchar(32) NOT NULL,
	`baseCurrency` varchar(3) NOT NULL DEFAULT 'SAR',
	`timeZone` varchar(64) NOT NULL DEFAULT 'Asia/Riyadh',
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `companies_companyCode_unique` UNIQUE(`companyCode`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`customerCode` varchar(40) NOT NULL,
	`legalName` varchar(255) NOT NULL,
	`taxNumber` varchar(64),
	`contactName` varchar(160),
	`phone` varchar(48),
	`email` varchar(320),
	`creditLimit` decimal(18,2) NOT NULL DEFAULT '0',
	`customerStatus` enum('active','inactive','blocked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_company_code_unique` UNIQUE(`companyId`,`customerCode`)
);
--> statement-breakpoint
CREATE TABLE `inventoryLocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`branchId` int NOT NULL,
	`locationCode` varchar(48) NOT NULL,
	`name` varchar(160) NOT NULL,
	`locationType` enum('warehouse','ground_tank','tanker') NOT NULL,
	`capacity` decimal(18,3),
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryLocations_id` PRIMARY KEY(`id`),
	CONSTRAINT `locations_company_code_unique` UNIQUE(`companyId`,`locationCode`)
);
--> statement-breakpoint
CREATE TABLE `inventoryMovements` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`branchId` int NOT NULL,
	`itemId` int NOT NULL,
	`fromLocationId` int,
	`toLocationId` int,
	`stockDirection` enum('in','out','transfer','adjustment') NOT NULL,
	`quantity` decimal(18,3) NOT NULL,
	`unitCost` decimal(18,4),
	`referenceType` varchar(48) NOT NULL,
	`referenceId` varchar(64) NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`itemCode` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`itemType` enum('inventory','fuel','service') NOT NULL,
	`unitOfMeasure` varchar(32) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `items_id` PRIMARY KEY(`id`),
	CONSTRAINT `items_company_code_unique` UNIQUE(`companyId`,`itemCode`)
);
--> statement-breakpoint
CREATE TABLE `journalEntries` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`periodId` int NOT NULL,
	`entryNumber` varchar(64) NOT NULL,
	`sourceType` varchar(48) NOT NULL,
	`sourceId` varchar(64) NOT NULL,
	`journalStatus` enum('draft','approved','posted','reversed') NOT NULL DEFAULT 'draft',
	`occurredAt` timestamp NOT NULL,
	`createdBy` int NOT NULL,
	`approvedBy` int,
	`postedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journalEntries_id` PRIMARY KEY(`id`),
	CONSTRAINT `journals_company_number_unique` UNIQUE(`companyId`,`entryNumber`)
);
--> statement-breakpoint
CREATE TABLE `journalLines` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`journalEntryId` bigint NOT NULL,
	`lineNumber` int NOT NULL,
	`accountId` int NOT NULL,
	`debit` decimal(18,2) NOT NULL DEFAULT '0',
	`credit` decimal(18,2) NOT NULL DEFAULT '0',
	`narration` varchar(500),
	CONSTRAINT `journalLines_id` PRIMARY KEY(`id`),
	CONSTRAINT `journal_lines_entry_line_unique` UNIQUE(`journalEntryId`,`lineNumber`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`supplierCode` varchar(40) NOT NULL,
	`legalName` varchar(255) NOT NULL,
	`taxNumber` varchar(64),
	`contactName` varchar(160),
	`phone` varchar(48),
	`email` varchar(320),
	`supplierStatus` enum('active','inactive','blocked') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `suppliers_company_code_unique` UNIQUE(`companyId`,`supplierCode`)
);
--> statement-breakpoint
CREATE TABLE `userScopes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyId` int NOT NULL,
	`branchId` int,
	`dataScope` enum('company','branch','assigned') NOT NULL DEFAULT 'assigned',
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userScopes_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_scopes_user_company_branch_unique` UNIQUE(`userId`,`companyId`,`branchId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','manager','accountant','user') NOT NULL DEFAULT 'user';--> statement-breakpoint
CREATE INDEX `audit_events_company_entity_time_idx` ON `auditEvents` (`companyId`,`entityType`,`entityId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `commercial_documents_company_kind_status_idx` ON `commercialDocuments` (`companyId`,`documentKind`,`documentStatus`);--> statement-breakpoint
CREATE INDEX `inventory_movements_item_time_idx` ON `inventoryMovements` (`companyId`,`itemId`,`occurredAt`);
CREATE TABLE `cashAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`accountCode` varchar(40) NOT NULL,
	`name` varchar(160) NOT NULL,
	`cashAccountKind` enum('bank','cash_box') NOT NULL,
	`currency` varchar(3) NOT NULL,
	`bankName` varchar(160),
	`accountReference` varchar(96),
	`cashAccountStatus` enum('active','inactive','blocked') NOT NULL DEFAULT 'active',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cashAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `cash_accounts_company_code_unique` UNIQUE(`companyId`,`accountCode`)
);
--> statement-breakpoint
CREATE TABLE `companySettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`settingKey` varchar(96) NOT NULL,
	`settingValue` json NOT NULL,
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companySettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_settings_company_key_unique` UNIQUE(`companyId`,`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`employeeCode` varchar(40) NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`department` varchar(160),
	`jobTitle` varchar(160),
	`workEmail` varchar(320),
	`employeeStatus` enum('active','on_leave','inactive') NOT NULL DEFAULT 'active',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `employees_company_code_unique` UNIQUE(`companyId`,`employeeCode`)
);
--> statement-breakpoint
CREATE TABLE `fixedAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`assetCode` varchar(48) NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(160) NOT NULL,
	`serialNumber` varchar(128),
	`acquiredAt` timestamp,
	`locationDescription` varchar(255),
	`assetStatus` enum('planned','active','under_maintenance','disposed') NOT NULL DEFAULT 'planned',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fixedAssets_id` PRIMARY KEY(`id`),
	CONSTRAINT `fixed_assets_company_code_unique` UNIQUE(`companyId`,`assetCode`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`projectCode` varchar(40) NOT NULL,
	`name` varchar(255) NOT NULL,
	`customerId` int,
	`managerUserId` int,
	`projectStatus` enum('draft','active','on_hold','completed','closed') NOT NULL DEFAULT 'draft',
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_company_code_unique` UNIQUE(`companyId`,`projectCode`)
);

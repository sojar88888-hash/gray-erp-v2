const SENSITIVE_FIELD_PATTERN = /(password|token|secret|api.?key|authorization|cookie)/i;

export type AuditSnapshot = Record<string, unknown> | null;

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        SENSITIVE_FIELD_PATTERN.test(key) ? "[محجوب]" : sanitizeValue(nestedValue),
      ]),
    );
  }
  return value;
}

export function sanitizeAuditSnapshot(snapshot: AuditSnapshot): AuditSnapshot {
  if (!snapshot) return null;
  return sanitizeValue(snapshot) as Record<string, unknown>;
}

export type AuditEventInput = {
  companyId: number;
  actorUserId: number | null;
  action: "create" | "update" | "cancel" | "approve" | "export" | "login";
  entityType: string;
  entityId: string;
  requestId?: string | null;
  beforeData?: AuditSnapshot;
  afterData?: AuditSnapshot;
};

export function validateAuditEvent(input: AuditEventInput): AuditEventInput {
  if (!Number.isInteger(input.companyId) || input.companyId <= 0) {
    throw new Error("معرف الشركة مطلوب لتسجيل حدث التدقيق.");
  }
  if (!input.entityType.trim() || !input.entityId.trim()) {
    throw new Error("نوع الكيان ومعرفه مطلوبان لتسجيل حدث التدقيق.");
  }
  return {
    ...input,
    entityType: input.entityType.trim(),
    entityId: input.entityId.trim(),
    beforeData: sanitizeAuditSnapshot(input.beforeData ?? null),
    afterData: sanitizeAuditSnapshot(input.afterData ?? null),
  };
}

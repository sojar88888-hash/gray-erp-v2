import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const previewSource = readFileSync(new URL("../client/src/components/ReferenceDocumentPreview.tsx", import.meta.url), "utf8");

describe("Reference document previews", () => {
  it("marks every reference template as an unapproved preview", () => {
    expect(previewSource).toContain("معاينة غير معتمدة");
    expect(previewSource).toContain("GRAY GROUP · REFERENCE TEMPLATE");
  });

  it("keeps receipt previews outside cash and accounting posting flows", () => {
    expect(previewSource).toContain("لا تنشئ حركة نقدية أو قيدًا محاسبيًا");
    expect(previewSource).toContain("لا تمثل فاتورة ضريبية أو مستندًا مرحلًا");
  });
});

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { assertSameOriginForMutation } from "./trpc";
import { ENV } from "./env";
import type { TrpcContext } from "./context";

function request(headers: Record<string, string>): TrpcContext["req"] {
  return { protocol: "https", headers } as TrpcContext["req"];
}

describe("حارس مصدر عمليات التغيير", () => {
  const originalAppOrigin = ENV.appOrigin;
  const originalProduction = ENV.isProduction;

  beforeEach(() => {
    ENV.appOrigin = "https://erp.example.test";
    ENV.isProduction = false;
  });

  afterEach(() => {
    ENV.appOrigin = originalAppOrigin;
    ENV.isProduction = originalProduction;
  });

  it("يسمح بالمصدر المطابق للمصدر المعتمد", () => {
    expect(() => assertSameOriginForMutation(request({ host: "erp.example.test", origin: "https://erp.example.test" }))).not.toThrow();
  });

  it("يرفض مصدرًا خارجيًا", () => {
    expect(() => assertSameOriginForMutation(request({ host: "erp.example.test", origin: "https://evil.example.test" }))).toThrowError(TRPCError);
  });

  it("يرفض Origin غير صالح", () => {
    expect(() => assertSameOriginForMutation(request({ host: "erp.example.test", origin: "not-a-url" }))).toThrow("مصدر الطلب غير صالح");
  });

  it("يرفض غياب Origin وReferer", () => {
    expect(() => assertSameOriginForMutation(request({ host: "erp.example.test" }))).toThrow("مصدر الطلب غير متوفر");
  });

  it("يرفض عدم تطابق Origin وReferer", () => {
    expect(() => assertSameOriginForMutation(request({ host: "erp.example.test", origin: "https://erp.example.test", referer: "https://evil.example.test/page" }))).toThrow("مصادر الطلب غير متطابقة");
  });

  it("يستخدم Referer عندما لا يتوفر Origin", () => {
    expect(() => assertSameOriginForMutation(request({ host: "erp.example.test", referer: "https://erp.example.test/sales" }))).not.toThrow();
  });
});

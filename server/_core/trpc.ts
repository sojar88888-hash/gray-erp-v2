import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { ENV } from "./env";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

function getConfiguredOrigin(): string | null {
  const configured = ENV.appOrigin.trim();
  if (!configured) return null;
  try {
    const origin = new URL(configured).origin;
    return origin;
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "إعداد مصدر التطبيق غير صالح." });
  }
}

function getRequestOrigin(req: TrpcContext["req"]): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto?.split(",")[0])?.trim() || req.protocol;
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost?.split(",")[0])?.trim() || req.headers.host || req.hostname;
  return `${protocol}://${host}`;
}

export function assertSameOriginForMutation(req: TrpcContext["req"]): void {
  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  const referer = Array.isArray(refererHeader) ? refererHeader[0] : refererHeader;

  // Mutation requests are browser-facing; fail closed when neither browser provenance header exists.
  if (!origin && !referer) {
    throw new TRPCError({ code: "FORBIDDEN", message: "مصدر الطلب غير متوفر." });
  }

  const candidates: string[] = [];
  for (const value of [origin, referer]) {
    if (!value) continue;
    try {
      candidates.push(new URL(value).origin);
    } catch {
      throw new TRPCError({ code: "FORBIDDEN", message: "مصدر الطلب غير صالح." });
    }
  }

  if (candidates.length === 2 && candidates[0] !== candidates[1]) {
    throw new TRPCError({ code: "FORBIDDEN", message: "مصادر الطلب غير متطابقة." });
  }

  const candidate = candidates[0];
  const configuredOrigin = getConfiguredOrigin();
  let requestOrigin: string;

  if (configuredOrigin) {
    requestOrigin = configuredOrigin;
  } else if (ENV.isProduction) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "APP_ORIGIN غير مهيأ في بيئة الإنتاج." });
  } else {
    try {
      requestOrigin = new URL(getRequestOrigin(req)).origin;
    } catch {
      throw new TRPCError({ code: "FORBIDDEN", message: "وجهة الطلب غير صالحة." });
    }
  }

  if (candidate !== requestOrigin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "مصدر الطلب غير مسموح به." });
  }
}

const requireSameOriginForMutations = t.middleware(async opts => {
  if (opts.type === "mutation") {
    assertSameOriginForMutation(opts.ctx.req);
  }
  return opts.next();
});

export const publicProcedure = t.procedure.use(requireSameOriginForMutations);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireSameOriginForMutations).use(requireUser);

export const adminProcedure = t.procedure.use(requireSameOriginForMutations).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Clock3, Loader2, ScrollText, ShieldCheck } from "lucide-react";

const actionLabel: Record<string, string> = { create: "إنشاء", update: "تعديل", cancel: "إلغاء", approve: "اعتماد", export: "تصدير", login: "تسجيل دخول" };

export default function AuditLogPanel({ accessDenied }: { accessDenied: boolean }) {
  const { isAuthenticated } = useAuth();
  const events = trpc.erp.audit.list.useQuery(undefined, { enabled: isAuthenticated && !accessDenied });

  return (
    <div className="rounded-2xl border border-[#1c4563] bg-[#092238] shadow-[0_18px_42px_rgba(0,0,0,0.15)]">
      <div className="flex items-center justify-between border-b border-[#193f5d] px-5 py-4 sm:px-6"><div><h3 className="text-sm font-bold text-[#e6f2fc]">أحداث التدقيق</h3><p className="mt-1 text-[10px] text-[#7899af]">آخر 50 حدثًا ضمن نطاق الشركة</p></div><span className="rounded-md border border-[#5f5138] bg-[#302919] px-2.5 py-1 text-[10px] font-semibold text-[#f0c874]">ملحق فقط</span></div>
      <div className="min-h-[285px] px-5 py-5 sm:px-6">
        {events.isLoading ? <div className="flex h-[190px] items-center justify-center gap-2 text-sm text-[#9ab9cf]"><Loader2 className="h-4 w-4 animate-spin" />جارٍ تحميل أحداث التدقيق…</div> : null}
        {events.error ? <div className="flex h-[190px] items-center justify-center text-center text-sm text-[#ffaca0]">{events.error.message}</div> : null}
        {!events.isLoading && !events.error && (!events.data || events.data.length === 0) ? <div className="flex h-[190px] flex-col items-center justify-center text-center"><div className="grid h-11 w-11 place-items-center rounded-xl border border-[#55492f] bg-[#2d291c] text-[#e4bb68]"><ScrollText className="h-5 w-5" /></div><h4 className="mt-3 text-sm font-bold text-[#dbeaf6]">لا توجد أحداث تدقيق مسجلة</h4><p className="mt-1 text-xs text-[#7d9caf]">ستظهر عمليات التهيئة وإضافة البيانات المعتمدة هنا تلقائيًا.</p></div> : null}
        {!events.isLoading && !events.error && events.data && events.data.length > 0 ? <div className="space-y-2.5">{events.data.map((event) => <div key={event.id} className="flex items-center gap-3 rounded-xl border border-[#1e4865] bg-[#082940] p-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#123b52] text-[#70c9ff]"><ShieldCheck className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#d8edf9]">{actionLabel[event.action] ?? event.action} — {event.entityType}</p><p className="mt-1 text-[11px] text-[#7f9eb3]">معرف الكيان: {event.entityId}{event.actorUserId ? ` · مستخدم #${event.actorUserId}` : ""}</p></div><div className="flex items-center gap-1 text-[10px] text-[#9dbbd0]"><Clock3 className="h-3 w-3" />{new Date(event.occurredAt).toLocaleString("ar-SA")}</div></div>)}</div> : null}
      </div>
    </div>
  );
}

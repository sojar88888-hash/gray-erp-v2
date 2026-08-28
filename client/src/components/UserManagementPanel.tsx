import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { useState } from "react";

type Role = "admin" | "manager" | "accountant" | "user";

const roles: Record<Role, { label: string; tone: string }> = {
  admin: { label: "مدير النظام", tone: "border-[#5b4d21] bg-[#3b3219] text-[#f2d77e]" },
  manager: { label: "مدير", tone: "border-[#1e536d] bg-[#10364d] text-[#89d2f6]" },
  accountant: { label: "محاسب", tone: "border-[#315366] bg-[#193442] text-[#abdbd2]" },
  user: { label: "مستخدم", tone: "border-[#465164] bg-[#27313f] text-[#bdcad8]" },
};

export default function UserManagementPanel({ accessDenied, accessResolved }: { accessDenied: boolean; accessResolved: boolean }) {
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const [drafts, setDrafts] = useState<Record<number, Role>>({});
  const enabled = isAuthenticated && accessResolved && !accessDenied;
  const directory = trpc.erp.userManagement.list.useQuery(undefined, { enabled, retry: false });
  const setupRequired = Boolean(directory.error?.message.includes("إكمال تهيئة الشركة"));
  const updateRole = trpc.erp.userManagement.updateRole.useMutation({
    onSuccess: async (_, variables) => {
      setDrafts((current) => { const next = { ...current }; delete next[variables.targetUserId]; return next; });
      await utils.erp.userManagement.list.invalidate();
    },
  });
  const inputClass = "h-9 min-w-[132px] rounded-lg border border-[#2b5773] bg-[#071e31] px-2 text-xs text-[#d8edf9] outline-none focus:border-[#4aaefa] focus:ring-2 focus:ring-[#2f8bca]/30 disabled:cursor-not-allowed disabled:opacity-60";

  return <div className="rounded-2xl border border-[#1c4563] bg-[#092238] shadow-[0_18px_42px_rgba(0,0,0,0.15)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#193f5d] px-5 py-4 sm:px-6"><div><h3 className="text-sm font-bold text-[#e6f2fc]">مستخدمو الشركة والأدوار</h3><p className="mt-1 text-[10px] text-[#7899af]">تُعرض الحسابات ذات النطاق النشط فقط. تعديل الدور يُسجل كأثر تدقيق خادمي ولا يغير نطاقات البيانات.</p></div><span className="rounded-md border border-[#2a5a79] bg-[#0b2d46] px-2 py-1 text-[10px] font-bold text-[#9ed5fa]">إدارة مقيدة</span></div>{directory.isLoading ? <State icon={<Loader2 className="h-5 w-5 animate-spin" />} title="جارٍ تحميل دليل المستخدمين…" /> : null}{setupRequired ? <State icon={<UsersRound className="h-5 w-5" />} title="يلزم تهيئة الشركة أولًا" detail="لن يظهر دليل مستخدمين قبل إنشاء نطاق الشركة والفروع الخاضعة لها." warm /> : null}{directory.error && !setupRequired ? <State icon={<ShieldAlert className="h-5 w-5" />} title="تعذر تحميل دليل المستخدمين" detail={directory.error.message} warm /> : null}{!directory.isLoading && !directory.error && directory.data?.length === 0 ? <State icon={<UsersRound className="h-5 w-5" />} title="لا توجد نطاقات مستخدمين نشطة" detail="أضف نطاقات مستخدمين عبر مسار الحوكمة المؤسسي قبل إسناد دور أو توسيع الوصول." /> : null}{directory.data?.length ? <div className="divide-y divide-[#173d59]">{directory.data.map((member) => { const proposed = drafts[member.userId] ?? member.role; const isSelf = member.userId === user?.id; const changed = proposed !== member.role; const busy = updateRole.isPending && updateRole.variables?.targetUserId === member.userId; return <div key={member.userId} className="space-y-3 px-5 py-4 sm:px-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-[#ddecfa]">{member.name || "مستخدم غير مسمى"}</p><span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${roles[member.role].tone}`}>{roles[member.role].label}</span>{isSelf ? <span className="rounded-md border border-[#405b70] bg-[#102c41] px-2 py-0.5 text-[10px] text-[#a6c7dc]">الحساب الحالي محمي</span> : null}</div><p className="mt-1 truncate text-[11px] text-[#86a8bf]">{member.email || "لا يوجد بريد ظاهر"}</p><div className="mt-2 flex flex-wrap gap-1.5">{member.scopeSummary.map((scope) => <span key={scope} className="rounded-md bg-[#0b2f49] px-2 py-1 text-[10px] text-[#a6d0e8]">{scope}</span>)}</div></div><div className="flex flex-wrap items-center gap-2"><select value={proposed} onChange={(event) => setDrafts((current) => ({ ...current, [member.userId]: event.target.value as Role }))} disabled={isSelf || busy} className={inputClass}>{(Object.keys(roles) as Role[]).map((role) => <option key={role} value={role}>{roles[role].label}</option>)}</select><Button onClick={() => updateRole.mutate({ targetUserId: member.userId, role: proposed })} disabled={!changed || isSelf || busy} className="h-9 rounded-lg bg-[#1a6c9f] px-3 text-xs text-white hover:bg-[#1d7dc2] disabled:opacity-50">{busy ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <UserCog className="ml-1 h-3.5 w-3.5" />}اعتماد الدور</Button></div></div><p className="text-[10px] text-[#7899af]">آخر دخول: {new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(member.lastSignedIn))} · الدور مركزي؛ تُمنع تعديلات حسابات مرتبطة بشركة أخرى أو تخفيض آخر مدير نظام.</p></div>; })}</div> : null}{updateRole.error ? <p className="mx-5 mb-5 rounded-lg border border-[#773d44] bg-[#321f29] px-3 py-2 text-xs text-[#ffb3aa]">{updateRole.error.message}</p> : null}<div className="flex items-start gap-2 border-t border-[#193f5d] bg-[#071e31] px-5 py-3 text-[10px] leading-5 text-[#91b2c9]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#6fc8ff]" />لا يتيح هذا المسار دعوة مستخدمين أو حذفهم أو تعديل نطاق الفرع؛ وهو مخصص للعرض وتغيير الدور المحكوم ضمن الشركة فقط.</div></div>;
}

function State({ icon, title, detail, warm }: { icon: React.ReactNode; title: string; detail?: string; warm?: boolean }) {
  return <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center"><div className={`grid h-11 w-11 place-items-center rounded-xl border ${warm ? "border-[#5b4a2e] bg-[#2d261c] text-[#edc56c]" : "border-[#27506e] bg-[#0c2c45] text-[#70c4ff]"}`}>{icon}</div><h4 className={`mt-3 text-sm font-bold ${warm ? "text-[#f2dfad]" : "text-[#d8eaf7]"}`}>{title}</h4>{detail ? <p className={`mt-1 max-w-md text-xs leading-5 ${warm ? "text-[#bcae89]" : "text-[#7f9eb3]"}`}>{detail}</p> : null}</div>;
}

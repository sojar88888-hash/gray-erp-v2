import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { BellRing, Building2, CheckCircle2, Loader2, Plus, Save, Settings2, ShieldCheck, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type OperationalPolicy = {
  defaultDocumentCurrency: string;
  approvalMode: "controlled" | "manual_review";
  notificationDigestEnabled: boolean;
};

const initialPolicy: OperationalPolicy = {
  defaultDocumentCurrency: "SAR",
  approvalMode: "controlled",
  notificationDigestEnabled: true,
};

function policyFrom(value: unknown): OperationalPolicy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<OperationalPolicy>;
  if (typeof candidate.defaultDocumentCurrency !== "string") return null;
  if (candidate.approvalMode !== "controlled" && candidate.approvalMode !== "manual_review") return null;
  if (typeof candidate.notificationDigestEnabled !== "boolean") return null;
  return {
    defaultDocumentCurrency: candidate.defaultDocumentCurrency.toUpperCase(),
    approvalMode: candidate.approvalMode,
    notificationDigestEnabled: candidate.notificationDigestEnabled,
  };
}

export default function CompanySettingsPanel({ accessDenied, accessResolved }: { accessDenied: boolean; accessResolved: boolean }) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const list = trpc.erp.settings.list.useQuery(undefined, { enabled: isAuthenticated && accessResolved && !accessDenied, retry: false });
  const operationalPolicySetting = useMemo(() => list.data?.find((setting) => setting.settingKey === "operational_policy"), [list.data]);
  const storedPolicy = useMemo(() => policyFrom(operationalPolicySetting?.settingValue), [operationalPolicySetting?.settingValue]);
  const [policy, setPolicy] = useState<OperationalPolicy>(initialPolicy);
  const [saved, setSaved] = useState(false);
  const [branchCode, setBranchCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const setupRequired = Boolean(list.error?.message.includes("إكمال تهيئة الشركة"));
  const branches = trpc.erp.organization.branches.list.useQuery(undefined, { enabled: isAuthenticated && accessResolved && !accessDenied, retry: false });

  useEffect(() => {
    if (storedPolicy) setPolicy(storedPolicy);
  }, [storedPolicy]);

  const save = trpc.erp.settings.upsertOperationalPolicy.useMutation({
    onSuccess: async () => {
      setSaved(true);
      await utils.erp.settings.list.invalidate();
    },
  });
  const createBranch = trpc.erp.organization.branches.create.useMutation({
    onSuccess: async () => {
      setBranchCode(""); setBranchName("");
      await utils.erp.organization.branches.list.invalidate();
    },
  });

  const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-[#264f6c] bg-[#071c2e] px-3 text-sm text-[#e7f4ff] outline-none transition focus:border-[#4aaefa] focus:ring-2 focus:ring-[#2f8bca]/30 disabled:cursor-not-allowed disabled:opacity-60";
  const canSave = isAuthenticated && accessResolved && !accessDenied && !setupRequired && !save.isPending;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    save.mutate({ ...policy, defaultDocumentCurrency: policy.defaultDocumentCurrency.toUpperCase() });
  }

  function submitBranch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createBranch.mutate({ branchCode, name: branchName });
  }

  return <div className="rounded-2xl border border-[#1c4563] bg-[#092238] shadow-[0_18px_42px_rgba(0,0,0,0.15)]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#193f5d] px-5 py-4 sm:px-6">
      <div><h3 className="text-sm font-bold text-[#e6f2fc]">سياسة التشغيل الأساسية</h3><p className="mt-1 text-[10px] text-[#7899af]">إعدادات غير مالية تتطلب دور الإدارة وتولد أثر تدقيق ملحقًا.</p></div>
      <span className="rounded-md border border-[#2a5a79] bg-[#0b2d46] px-2 py-1 text-[10px] font-bold text-[#9ed5fa]">إعدادات الشركة</span>
    </div>
    {list.isLoading ? <div className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-[#9ab9cf]"><Loader2 className="h-4 w-4 animate-spin" />جارٍ تحميل الإعدادات…</div> : null}
    {setupRequired ? <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center"><div className="grid h-11 w-11 place-items-center rounded-xl border border-[#5b4a2e] bg-[#2d261c] text-[#edc56c]"><Building2 className="h-5 w-5" /></div><h4 className="mt-3 text-sm font-bold text-[#f2dfad]">يلزم تهيئة الشركة أولًا</h4><p className="mt-1 max-w-sm text-xs leading-5 text-[#bcae89]">بعد تهيئة نطاق الشركة من صفحة الإدارة ستصبح الإعدادات قابلة للقراءة والتحديث وفق دورك.</p></div> : null}
    {list.error && !setupRequired ? <div className="flex min-h-[320px] items-center justify-center px-6 text-center text-sm text-[#ffaca0]">{list.error.message}</div> : null}
    {!list.isLoading && !list.error ? <form onSubmit={submit} className="space-y-5 px-5 py-5 sm:px-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-[#c7dfef]">عملة المستندات الافتراضية<input value={policy.defaultDocumentCurrency} onChange={(event) => setPolicy((current) => ({ ...current, defaultDocumentCurrency: event.target.value.toUpperCase() }))} required pattern="[A-Za-z]{3}" maxLength={3} className={inputClass} placeholder="SAR" disabled={!canSave} /></label>
        <label className="text-xs font-bold text-[#c7dfef]">نمط مراجعة المستندات<select value={policy.approvalMode} onChange={(event) => setPolicy((current) => ({ ...current, approvalMode: event.target.value as OperationalPolicy["approvalMode"] }))} className={inputClass} disabled={!canSave}><option value="controlled">مراجعة محكومة</option><option value="manual_review">مراجعة يدوية</option></select></label>
      </div>
      <label className="flex items-center justify-between gap-4 rounded-xl border border-[#214b67] bg-[#08253c] p-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#164563] text-[#7cd0ff]"><BellRing className="h-4 w-4" /></div><div><p className="text-xs font-bold text-[#ddecfa]">ملخص الإشعارات التشغيلي</p><p className="mt-1 text-[10px] leading-4 text-[#84a6bd]">تفضيل عرض فقط؛ لا ينشئ تنفيذًا مجدولًا أو إشعارًا تلقائيًا.</p></div></div><input type="checkbox" checked={policy.notificationDigestEnabled} onChange={(event) => setPolicy((current) => ({ ...current, notificationDigestEnabled: event.target.checked }))} disabled={!canSave} className="h-4 w-4 rounded border-[#37627d] accent-[#2d98df] disabled:opacity-50" /></label>
      {save.error ? <p className="rounded-lg border border-[#773d44] bg-[#321f29] px-3 py-2 text-xs text-[#ffb3aa]">{save.error.message}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#193f5d] pt-4"><div className="flex items-center gap-2 text-[10px] leading-5 text-[#88a9c0]"><ShieldCheck className="h-4 w-4 shrink-0 text-[#69c7ef]" />لا يغير هذا النموذج بوابات الجاهزية المالية ولا ينشئ قيدًا أو موافقة أو ترحيلًا.</div><Button type="submit" disabled={!canSave} className="h-9 rounded-lg bg-[#1d7dc2] px-3 text-xs text-white hover:bg-[#176aa7] disabled:opacity-50">{save.isPending ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <Save className="ml-1 h-3.5 w-3.5" />}حفظ السياسة</Button></div>
      {saved ? <p className="flex items-center gap-2 text-xs text-[#75dfb1]"><CheckCircle2 className="h-4 w-4" />حُفظت السياسة وسُجل أثر التدقيق الخادمي.</p> : null}
      <div className="rounded-xl border border-[#214a67] bg-[#071e31] px-3 py-2.5 text-[10px] text-[#8eafc5]"><Settings2 className="ml-1 inline h-3.5 w-3.5 text-[#6fc8ff]" />{operationalPolicySetting ? `آخر تحديث: ${new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(operationalPolicySetting.updatedAt))}` : "لم تحفظ سياسة تشغيلية إضافية بعد؛ ستطبق قيم البداية عند أول حفظ."}</div>
      <section className="rounded-xl border border-[#214b67] bg-[#071e31] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#164563] text-[#7cd0ff]"><Store className="h-4 w-4" /></div><div><h4 className="text-xs font-bold text-[#ddecfa]">الفروع التشغيلية</h4><p className="mt-1 text-[10px] leading-4 text-[#84a6bd]">يُنشأ الفرع الرئيسي تلقائيًا للشركات الجديدة. إنشاء الفرع يولد أثر تدقيق ولا يغير نطاقات مستخدمين قائمة.</p></div></div><span className="rounded-md bg-[#0b304a] px-2 py-1 text-[10px] font-bold text-[#9ed5fa]">{branches.data?.length ?? 0} فرع نشط</span></div>{branches.isLoading ? <p className="mt-3 flex items-center gap-2 text-xs text-[#9ab9cf]"><Loader2 className="h-3.5 w-3.5 animate-spin" />جارٍ تحميل الفروع…</p> : null}{branches.error ? <p className="mt-3 rounded-lg border border-[#773d44] bg-[#321f29] px-3 py-2 text-xs text-[#ffb3aa]">{branches.error.message}</p> : null}{branches.data?.length ? <div className="mt-3 flex flex-wrap gap-2">{branches.data.map((branch) => <span key={branch.id} className="rounded-lg border border-[#27516d] bg-[#092942] px-2.5 py-1.5 text-[10px] text-[#c1dced]"><b className="font-mono text-[#76c9f5]">{branch.branchCode}</b> — {branch.name}</span>)}</div> : null}<form onSubmit={submitBranch} className="mt-4 grid gap-3 sm:grid-cols-[0.7fr_1.3fr_auto]"><label className="text-xs font-bold text-[#c7dfef]">رمز الفرع<input value={branchCode} onChange={(event) => setBranchCode(event.target.value.toUpperCase())} required pattern="[A-Za-z0-9_-]{2,32}" maxLength={32} className={inputClass} placeholder="BR-01" disabled={!canSave || createBranch.isPending} /></label><label className="text-xs font-bold text-[#c7dfef]">اسم الفرع<input value={branchName} onChange={(event) => setBranchName(event.target.value)} required minLength={2} maxLength={160} className={inputClass} placeholder="فرع المنطقة" disabled={!canSave || createBranch.isPending} /></label><Button type="submit" disabled={!canSave || createBranch.isPending} className="self-end h-10 rounded-lg bg-[#155d91] px-3 text-xs text-white hover:bg-[#1d7dc2]">{createBranch.isPending ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="ml-1 h-3.5 w-3.5" />}إضافة فرع</Button></form>{createBranch.error ? <p className="mt-2 text-xs text-[#ffb3aa]">{createBranch.error.message}</p> : null}</section>
    </form> : null}
  </div>;
}

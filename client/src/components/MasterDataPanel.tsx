import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Box, Building2, Loader2, Plus, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";

type MasterDataKind = "customer" | "supplier" | "item";

const content = {
  customer: { singular: "عميل", plural: "العملاء", code: "رمز العميل", name: "الاسم القانوني", icon: UsersRound, empty: "لا توجد بيانات عملاء بعد" },
  supplier: { singular: "مورد", plural: "الموردون", code: "رمز المورد", name: "الاسم القانوني", icon: Building2, empty: "لا توجد بيانات موردين بعد" },
  item: { singular: "صنف", plural: "الأصناف", code: "رمز الصنف", name: "اسم الصنف", icon: Box, empty: "لا توجد أصناف مخزون بعد" },
} as const;

export default function MasterDataPanel({ kind, accessDenied, accessResolved }: { kind: MasterDataKind; accessDenied: boolean; accessResolved: boolean }) {
  const { isAuthenticated } = useAuth();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [itemType, setItemType] = useState<"inventory" | "fuel" | "service">("inventory");
  const [unitOfMeasure, setUnitOfMeasure] = useState("وحدة");
  const info = content[kind];
  const Icon = info.icon;

  const queryEnabled = isAuthenticated && accessResolved && !accessDenied;
  const customers = trpc.erp.masterData.customers.list.useQuery(undefined, { enabled: queryEnabled && kind === "customer" });
  const suppliers = trpc.erp.masterData.suppliers.list.useQuery(undefined, { enabled: queryEnabled && kind === "supplier" });
  const items = trpc.erp.masterData.items.list.useQuery(undefined, { enabled: queryEnabled && kind === "item" });
  const data = kind === "customer" ? customers.data : kind === "supplier" ? suppliers.data : items.data;
  const isLoading = kind === "customer" ? customers.isLoading : kind === "supplier" ? suppliers.isLoading : items.isLoading;
  const queryError = kind === "customer" ? customers.error : kind === "supplier" ? suppliers.error : items.error;

  const finish = () => {
    setCreating(false); setCode(""); setName(""); setTaxNumber(""); setPhone(""); setEmail(""); setItemType("inventory"); setUnitOfMeasure("وحدة");
    if (kind === "customer") void customers.refetch();
    if (kind === "supplier") void suppliers.refetch();
    if (kind === "item") void items.refetch();
  };
  const customerCreate = trpc.erp.masterData.customers.create.useMutation({ onSuccess: () => { toast.success("تم إنشاء العميل وتسجيل حدث التدقيق."); finish(); }, onError: (error) => toast.error(error.message) });
  const supplierCreate = trpc.erp.masterData.suppliers.create.useMutation({ onSuccess: () => { toast.success("تم إنشاء المورد وتسجيل حدث التدقيق."); finish(); }, onError: (error) => toast.error(error.message) });
  const itemCreate = trpc.erp.masterData.items.create.useMutation({ onSuccess: () => { toast.success("تم إنشاء الصنف وتسجيل حدث التدقيق."); finish(); }, onError: (error) => toast.error(error.message) });
  const isSaving = customerCreate.isPending || supplierCreate.isPending || itemCreate.isPending;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (kind === "customer") customerCreate.mutate({ customerCode: code, legalName: name, taxNumber: taxNumber || undefined, phone: phone || undefined, email: email || undefined });
    if (kind === "supplier") supplierCreate.mutate({ supplierCode: code, legalName: name, taxNumber: taxNumber || undefined, phone: phone || undefined, email: email || undefined });
    if (kind === "item") itemCreate.mutate({ itemCode: code, name, itemType, unitOfMeasure });
  };

  return (
    <div className="rounded-2xl border border-[#1c4563] bg-[#092238] shadow-[0_18px_42px_rgba(0,0,0,0.15)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#193f5d] px-5 py-4 sm:px-6">
        <div><h3 className="text-sm font-bold text-[#e6f2fc]">سجل {info.plural}</h3><p className="mt-1 text-[10px] text-[#7899af]">بيانات فعلية محكومة بنطاق الشركة والصلاحيات</p></div>
        <Button onClick={() => setCreating((open) => !open)} disabled={!isAuthenticated || accessDenied} className="h-9 rounded-lg bg-[#1d7dc2] px-3 text-xs text-white hover:bg-[#176aa7] disabled:opacity-50"><Plus className="ml-1 h-3.5 w-3.5" />إضافة {info.singular}</Button>
      </div>
      {creating ? (
        <form onSubmit={submit} className="border-b border-[#193f5d] bg-[#071d30] px-5 py-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-[11px] font-bold text-[#a7c5da]">{info.code}</span><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required pattern="[A-Za-z0-9_-]{2,64}" placeholder="مثال: CUS-001" className="h-10 w-full rounded-lg border border-[#24506e] bg-[#0a2941] px-3 text-sm text-[#e6f4ff] outline-none placeholder:text-[#57768d] focus:border-[#54b9f4]" /></label><label className="space-y-1"><span className="text-[11px] font-bold text-[#a7c5da]">{info.name}</span><input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="h-10 w-full rounded-lg border border-[#24506e] bg-[#0a2941] px-3 text-sm text-[#e6f4ff] outline-none focus:border-[#54b9f4]" /></label></div>
          {kind === "item" ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-[11px] font-bold text-[#a7c5da]">نوع الصنف</span><select value={itemType} onChange={(e) => setItemType(e.target.value as typeof itemType)} className="h-10 w-full rounded-lg border border-[#24506e] bg-[#0a2941] px-3 text-sm text-[#e6f4ff] outline-none focus:border-[#54b9f4]"><option value="inventory">مخزون</option><option value="fuel">وقود</option><option value="service">خدمة</option></select></label><label className="space-y-1"><span className="text-[11px] font-bold text-[#a7c5da]">وحدة القياس</span><input value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} required maxLength={32} className="h-10 w-full rounded-lg border border-[#24506e] bg-[#0a2941] px-3 text-sm text-[#e6f4ff] outline-none focus:border-[#54b9f4]" /></label></div> : <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="space-y-1"><span className="text-[11px] font-bold text-[#a7c5da]">الرقم الضريبي</span><input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} maxLength={64} className="h-10 w-full rounded-lg border border-[#24506e] bg-[#0a2941] px-3 text-sm text-[#e6f4ff] outline-none focus:border-[#54b9f4]" /></label><label className="space-y-1"><span className="text-[11px] font-bold text-[#a7c5da]">الهاتف</span><input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={48} className="h-10 w-full rounded-lg border border-[#24506e] bg-[#0a2941] px-3 text-sm text-[#e6f4ff] outline-none focus:border-[#54b9f4]" /></label><label className="space-y-1"><span className="text-[11px] font-bold text-[#a7c5da]">البريد الإلكتروني</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={320} className="h-10 w-full rounded-lg border border-[#24506e] bg-[#0a2941] px-3 text-sm text-[#e6f4ff] outline-none focus:border-[#54b9f4]" /></label></div>}
          <div className="mt-4 flex items-center justify-between"><p className="text-[11px] text-[#7998ac]">يُسجل إنشاء هذا السجل في سجل التدقيق تلقائيًا.</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setCreating(false)} disabled={isSaving} className="h-9 rounded-lg border-[#254c67] bg-[#0a2941] text-xs text-[#bdd8eb] hover:bg-[#11344e] hover:text-white">إلغاء</Button><Button type="submit" disabled={isSaving} className="h-9 rounded-lg bg-[#1d7dc2] text-xs text-white hover:bg-[#176aa7]">{isSaving ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : null}حفظ</Button></div></div>
        </form>
      ) : null}
      <div className="min-h-[250px] px-5 py-5 sm:px-6">
        {isLoading ? <div className="flex h-[190px] items-center justify-center gap-2 text-sm text-[#9ab9cf]"><Loader2 className="h-4 w-4 animate-spin" />جارٍ تحميل السجل…</div> : null}
        {queryError ? <div className="flex h-[190px] items-center justify-center text-center text-sm leading-6 text-[#ffaca0]">{queryError.message}</div> : null}
        {!isLoading && !queryError && (!data || data.length === 0) ? <div className="flex h-[190px] flex-col items-center justify-center text-center"><div className="grid h-11 w-11 place-items-center rounded-xl border border-[#24506e] bg-[#0a2941] text-[#6ec9ff]"><Icon className="h-5 w-5" /></div><h4 className="mt-3 text-sm font-bold text-[#dcecf8]">{accessDenied ? "الوصول إلى السجل مقيّد" : info.empty}</h4><p className="mt-1 text-xs text-[#7d9caf]">{accessDenied ? "لا يتم تحميل بيانات هذه الوحدة قبل التحقق من نطاق الصلاحية." : isAuthenticated ? "أضف أول سجل بعد التحقق من بياناته القانونية والتشغيلية." : "سجّل الدخول للوصول إلى السجل المؤسسي."}</p></div> : null}
        {!isLoading && !queryError && data && data.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-right"><thead><tr className="border-b border-[#193f5d] text-[11px] text-[#82a4b9]"><th className="pb-3 font-semibold">الرمز</th><th className="pb-3 font-semibold">الاسم</th><th className="pb-3 font-semibold">الحالة</th></tr></thead><tbody>{data.map((entry) => <tr key={entry.id} className="border-b border-[#123650] text-sm text-[#c4dcec]"><td className="py-3 font-mono text-xs">{"customerCode" in entry ? entry.customerCode : "supplierCode" in entry ? entry.supplierCode : entry.itemCode}</td><td className="py-3 font-semibold">{"legalName" in entry ? entry.legalName : entry.name}</td><td className="py-3"><span className="rounded-md bg-[#124535] px-2 py-1 text-[10px] font-bold text-[#74e3b4]">نشط</span></td></tr>)}</tbody></table></div> : null}
      </div>
    </div>
  );
}

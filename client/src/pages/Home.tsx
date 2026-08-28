import CompanySetupDialog from "@/components/CompanySetupDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowLeft, Banknote, BarChart3, BellRing, Boxes, BriefcaseBusiness, Building2, CalendarDays, CheckCircle2, CircleDollarSign, ClipboardCheck, FileBarChart2, FileText, Landmark, PackageCheck, Plus, ReceiptText, Settings2, ShieldCheck, ShoppingCart, WalletCards } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const kpis = [
  { label: "إجمالي المبيعات", detail: "فواتير معتمدة", icon: ReceiptText, color: "#247bd8", glow: "rgba(36,123,216,.30)" },
  { label: "إجمالي المشتريات", detail: "فواتير موردين", icon: ShoppingCart, color: "#db861d", glow: "rgba(219,134,29,.28)" },
  { label: "التحصيلات", detail: "مبالغ محصلة ومطابقة", icon: Banknote, color: "#a860dd", glow: "rgba(168,96,221,.28)" },
  { label: "المدفوعات", detail: "مصروفات معتمدة", icon: WalletCards, color: "#189eb5", glow: "rgba(24,158,181,.28)" },
  { label: "الذمم المدينة", detail: "أرصدة العملاء", icon: CircleDollarSign, color: "#20a64e", glow: "rgba(32,166,78,.28)" },
  { label: "الذمم الدائنة", detail: "أرصدة الموردين", icon: Building2, color: "#d54146", glow: "rgba(213,65,70,.28)" },
  { label: "قيمة المخزون", detail: "حركات موثقة فقط", icon: Boxes, color: "#d9951b", glow: "rgba(217,149,27,.28)" },
  { label: "صافي الربح", detail: "يتطلب ترحيلًا معتمدًا", icon: Landmark, color: "#255eb6", glow: "rgba(37,94,182,.28)" },
];

const quickActions = [
  { label: "فاتورة مبيعات", path: "/sales", icon: ReceiptText, color: "#1257bc" },
  { label: "سند قبض", path: "/cash", icon: WalletCards, color: "#148351" },
  { label: "أمر شراء", path: "/purchases", icon: ShoppingCart, color: "#d37c17" },
  { label: "استلام مشتريات", path: "/purchases", icon: ClipboardCheck, color: "#6842b5" },
  { label: "فاتورة مشتريات", path: "/purchases", icon: FileText, color: "#176c9a" },
  { label: "سند صرف", path: "/cash", icon: Banknote, color: "#bd3740" },
  { label: "مصروف", path: "/cash", icon: ReceiptText, color: "#c78718" },
  { label: "تحويل مخزون", path: "/inventory", icon: Boxes, color: "#118c98" },
  { label: "جرد مخزون", path: "/inventory", icon: PackageCheck, color: "#168e4f" },
  { label: "تقرير مبيعات", path: "/reports", icon: FileBarChart2, color: "#633aaa" },
];

const actionRows = ["اعتمادات معلّقة", "فواتير متأخرة", "مستندات مسودة", "شيكات قيد التحصيل"];
const alertRows = ["حدود المخزون", "ضوابط الفترة", "مطابقة النقد", "فصل الواجبات"];

function PanelTitle({ title, description, icon: Icon, action }: { title: string; description?: string; icon: typeof BarChart3; action?: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2.5"><div className="grid h-8 w-8 place-items-center rounded-lg border border-[#24536f] bg-[#0d304b] text-[#7accff]"><Icon className="h-4 w-4" /></div><div><h3 className="text-sm font-bold text-[#eaf5fb]">{title}</h3>{description ? <p className="mt-0.5 text-[10px] text-[#7593a9]">{description}</p> : null}</div></div>{action}</div>;
}

function EmptyChart({ kind }: { kind: "area" | "bar" | "pie" }) {
  const chart = kind === "area" ? <AreaChart data={[]} margin={{ top: 18, right: 10, left: 0, bottom: 0 }}><defs><linearGradient id="gray-area" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#48beff" stopOpacity={.34} /><stop offset="1" stopColor="#48beff" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#1a4260" strokeDasharray="3 4" /><XAxis tick={false} axisLine={false} tickLine={false} /><YAxis tick={false} axisLine={false} tickLine={false} width={0} /><Area type="monotone" dataKey="value" stroke="#42b9ff" fill="url(#gray-area)" /></AreaChart> : kind === "bar" ? <BarChart data={[]} margin={{ top: 18, right: 10, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="#1a4260" strokeDasharray="3 4" /><XAxis tick={false} axisLine={false} tickLine={false} /><YAxis tick={false} axisLine={false} tickLine={false} width={0} /><Bar dataKey="value" fill="#287fd4" radius={[4, 4, 0, 0]} /></BarChart> : <PieChart><Pie data={[]} dataKey="value" innerRadius={45} outerRadius={72} /></PieChart>;
  return <div className="relative mt-3 h-[210px] overflow-hidden rounded-xl border border-[#183d59] bg-[radial-gradient(circle_at_50%_115%,rgba(32,139,222,.17),transparent_58%)]"><ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center text-center"><div className="grid h-9 w-9 place-items-center rounded-xl border border-[#285878] bg-[#0a2942] text-[#79cfff]"><BarChart3 className="h-4 w-4" /></div><p className="mt-2 text-xs font-bold text-[#dcecf7]">بانتظار بيانات معتمدة</p><p className="mt-1 text-[10px] text-[#7596ad]">لن تعرض اللوحة أرقامًا تجريبية.</p></div></div>;
}

function RegistryTable({ title, columns, icon: Icon }: { title: string; columns: string[]; icon: typeof Building2 }) {
  return <div className="overflow-hidden rounded-xl border border-[#1c425f] bg-[#082238]/90"><div className="border-b border-[#1b405c] bg-[#0b2b45] px-3 py-2.5"><PanelTitle title={title} icon={Icon} /></div><div className="overflow-x-auto"><table className="w-full min-w-[290px] text-right text-[10px]"><thead className="bg-[#0a1d30] text-[#95b1c5]"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap px-3 py-2 font-semibold">{column}</th>)}</tr></thead><tbody><tr><td colSpan={columns.length} className="h-[122px] text-center text-[#7896ab]">لا توجد سجلات معتمدة للعرض</td></tr></tbody></table></div></div>;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [setupOpen, setSetupOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const companySetup = trpc.erp.setup.status.useQuery(undefined, { enabled: isAuthenticated });
  const financialGate = trpc.erp.financial.readiness.useQuery();
  const company = companySetup.data;
  const gateBlocked = financialGate.data?.state === "blocked";

  const statusCards = [
    { label: "حالة النظام", value: "مستقر", detail: "لا توجد أعطال تشغيلية مسجلة", icon: CheckCircle2, color: "#2ece7c" },
    { label: "الفترة المالية", value: "غير مفعّلة", detail: "تتطلب سياسة سنة مالية", icon: CalendarDays, color: "#9072ed" },
    { label: "العملة الأساسية", value: company?.baseCurrency ?? "غير مهيأة", detail: company ? "شركة مهيأة" : "تهيئة الشركة مطلوبة", icon: CircleDollarSign, color: "#d9a739" },
    { label: "المؤسسة", value: company?.legalName ?? "غير مهيأة", detail: company ? company.timeZone : "ابدأ بالإعداد المؤسسي", icon: Building2, color: "#55baff" },
    { label: "جاهزية الترحيل", value: gateBlocked ? "محجوب" : "قيد التحقق", detail: financialGate.data ? `${financialGate.data.completed}/${financialGate.data.total} ضوابط مكتملة` : "جارٍ فحص الضوابط", icon: ShieldCheck, color: "#ff7a49" },
    { label: "المستخدمون النشطون", value: "بانتظار سجل", detail: "لا تُستنتج القيم دون مصدر", icon: ClipboardCheck, color: "#4bc5ad" },
  ];

  return <div className="space-y-3">
    <section className="relative overflow-hidden rounded-2xl border border-[#204c69] bg-[linear-gradient(105deg,#082d47,#061c31_52%,#0b3453)] px-4 py-4 shadow-[0_20px_42px_rgba(0,0,0,.2)] sm:px-5"><div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_6%_100%,rgba(34,143,221,.23),transparent_27%),radial-gradient(circle_at_94%_0%,rgba(238,106,37,.13),transparent_22%),linear-gradient(120deg,rgba(111,188,255,.07)_1px,transparent_1px)] [background-size:auto,auto,18px_18px]" /><div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div className="inline-flex items-center gap-1.5 rounded-full border border-[#356c92] bg-[#0a3352]/80 px-2.5 py-1 text-[10px] font-bold text-[#8fd2fc]"><BarChart3 className="h-3 w-3" />مركز التحكم التنفيذي</div><h1 className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">{company ? `لوحة قيادة ${company.legalName}` : "GRAY ERP — مركز القرار التشغيلي"}</h1><p className="mt-1.5 max-w-3xl text-xs leading-5 text-[#9bb9ce]">تصميم عالي الكثافة مستوحى من هوية GRAY GROUP؛ تظهر المؤشرات الفعلية بعد اكتمال مصادرها النظامية فقط.</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => setSetupOpen(true)} disabled={Boolean(company)} className="h-9 rounded-lg bg-[#e9691e] px-3.5 text-xs font-bold text-white hover:bg-[#c95716] disabled:opacity-60"><Plus className="ml-1.5 h-4 w-4" />{company ? "الإعداد مكتمل" : "تهيئة الشركة"}</Button><Button onClick={() => setLocation("/audit")} variant="outline" className="h-9 rounded-lg border-[#3d6684] bg-[#082941] px-3.5 text-xs text-[#d9f0ff] hover:bg-[#123b5a] hover:text-white"><ShieldCheck className="ml-1.5 h-4 w-4" />مراجعة الضوابط</Button></div></div></section>

    <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{statusCards.map((item) => { const Icon = item.icon; return <div key={item.label} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[#1c4563] bg-[linear-gradient(145deg,#0c304b,#082238)] p-2.5 shadow-[0_8px_20px_rgba(0,0,0,.14)]"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border" style={{ color: item.color, borderColor: `${item.color}55`, backgroundColor: `${item.color}16` }}><Icon className="h-3.5 w-3.5" /></div><div className="min-w-0"><p className="text-[10px] text-[#8ea9bc]">{item.label}</p><p className="truncate text-xs font-bold text-[#e8f5fd]">{item.value}</p><p className="truncate text-[9px] text-[#66859d]">{item.detail}</p></div></div>; })}</section>

    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">{kpis.map((item) => { const Icon = item.icon; return <div key={item.label} className="relative min-h-[130px] overflow-hidden rounded-xl border border-[#234d6a] bg-[linear-gradient(145deg,#11304a,#092138)] p-3 shadow-[0_12px_25px_rgba(0,0,0,.14)]"><div className="absolute inset-0" style={{ background: `radial-gradient(circle at 100% 0%,${item.glow},transparent 45%)` }} /><div className="relative flex items-start justify-between"><div><p className="text-[10px] font-bold text-[#bdd2e0]">{item.label}</p><p className="mt-4 text-xl font-extrabold text-white">—</p><p className="mt-1 text-[9px] text-[#7898ad]">{item.detail}</p></div><div className="grid h-8 w-8 place-items-center rounded-lg border" style={{ color: item.color, backgroundColor: `${item.color}1c`, borderColor: `${item.color}66` }}><Icon className="h-4 w-4" /></div></div><div className="relative mt-3 flex items-center gap-1.5 text-[9px] text-[#89a4b7]"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />بانتظار بيانات معتمدة</div></div>; })}</section>

    <section className="grid gap-3 2xl:grid-cols-12"><div className="2xl:col-span-4 rounded-2xl border border-[#1d4765] bg-[#082339]/94 p-3.5 shadow-[0_14px_30px_rgba(0,0,0,.14)]"><PanelTitle title="المبيعات والمشتريات" description="آخر 12 شهرًا بعد اعتماد المستندات" icon={BarChart3} action={<span className="rounded-md border border-[#274f6e] bg-[#0c2d49] px-2 py-1 text-[9px] text-[#95c5e9]">دون بيانات</span>} /><EmptyChart kind="bar" /></div><div className="2xl:col-span-3 rounded-2xl border border-[#1d4765] bg-[#082339]/94 p-3.5 shadow-[0_14px_30px_rgba(0,0,0,.14)]"><PanelTitle title="توزيع المبيعات" description="حسب الصنف أو المشروع" icon={ReceiptText} /><EmptyChart kind="pie" /></div><div className="2xl:col-span-3 rounded-2xl border border-[#1d4765] bg-[#082339]/94 p-3.5 shadow-[0_14px_30px_rgba(0,0,0,.14)]"><PanelTitle title="حركة النقد" description="المتحصلات والمدفوعات المطابقة" icon={WalletCards} /><EmptyChart kind="area" /></div><aside className="2xl:col-span-2 space-y-3"><div className="rounded-2xl border border-[#1d4765] bg-[#082339]/94 p-3.5"><PanelTitle title="المهام والتذكيرات" description="متابعة تشغيلية" icon={ClipboardCheck} /> <div className="mt-3 space-y-1.5">{actionRows.map((label) => <div key={label} className="flex items-center gap-2 rounded-lg border border-[#1b415e] bg-[#092940] px-2 py-2"><CheckCircle2 className="h-3.5 w-3.5 text-[#76c6f7]" /><span className="flex-1 text-[10px] font-semibold text-[#cedfeb]">{label}</span><span className="rounded bg-[#193c55] px-1.5 py-0.5 text-[9px] text-[#90aabd]">لا بيانات</span></div>)}</div></div><div className="rounded-2xl border border-[#1d4765] bg-[#082339]/94 p-3.5"><PanelTitle title="أحدث التنبيهات" description="مؤشرات رقابية" icon={BellRing} /><div className="mt-3 space-y-1.5">{alertRows.map((label) => <div key={label} className="flex items-center gap-2 rounded-lg border border-[#1b415e] bg-[#092940] px-2 py-2"><AlertTriangle className="h-3.5 w-3.5 text-[#ef8b4c]" /><span className="flex-1 text-[10px] font-semibold text-[#cedfeb]">{label}</span><span className="text-[9px] text-[#7897ac]">غير محسوب</span></div>)}</div><button onClick={() => setLocation("/audit")} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-[#27506e] py-1.5 text-[10px] font-semibold text-[#86c9f5] hover:bg-[#103751]">عرض سجل الرقابة <ArrowLeft className="h-3.5 w-3.5" /></button></div></aside></section>

    <section className="grid gap-3 xl:grid-cols-3"><RegistryTable title="أعمار الذمم المدينة" columns={["الفئة", "المبلغ", "النسبة"]} icon={CircleDollarSign} /><RegistryTable title="أهم العملاء" columns={["العميل", "الإجمالي", "الرصيد"]} icon={BriefcaseBusiness} /><RegistryTable title="أهم الموردين" columns={["المورد", "الإجمالي", "الحالة"]} icon={Building2} /></section>

    <section className="grid gap-3 xl:grid-cols-[1fr_.8fr]"><div className="rounded-2xl border border-[#1d4765] bg-[#082339]/94 p-3.5"><PanelTitle title="عمليات حديثة" description="تظهر المستندات والأحداث الفعلية عند إنشائها" icon={FileText} /><div className="mt-3 grid h-[104px] place-items-center rounded-xl border border-dashed border-[#284b67] bg-[#071f34]"><div className="text-center"><FileText className="mx-auto h-4 w-4 text-[#639ec7]" /><p className="mt-2 text-[11px] font-bold text-[#d9eaf5]">لا توجد عمليات مسجلة</p></div></div></div><div className="rounded-2xl border border-[#754146] bg-[linear-gradient(105deg,#2c1a28,#161e33_50%,#0b314a)] p-3.5"><PanelTitle title="بوابة الجاهزية المالية" description={financialGate.data?.reason ?? "جارٍ التحقق من حالة الحوكمة."} icon={ShieldCheck} action={<span className="rounded-lg border border-[#7c494f] bg-[#3c232b] px-2 py-1 text-[10px] font-bold text-[#ffbbb3]">{financialGate.data ? `${financialGate.data.completed}/${financialGate.data.total}` : "قيد التحميل"}</span>} /><p className="mt-4 text-xs font-bold text-[#ffd5d0]">لا يمكن إصدار قوائم أو ترحيل قيود من هذه الواجهة قبل اكتمال المتطلبات.</p></div></section>

    <section className="rounded-2xl border border-[#1d4a67] bg-[linear-gradient(90deg,#0b2943,#0d3654)] p-3.5 shadow-[0_16px_34px_rgba(0,0,0,.16)]"><div className="mb-3 flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-lg bg-[#164566] text-[#8dd1ff]"><PackageCheck className="h-4 w-4" /></div><div><h3 className="text-sm font-bold text-[#e9f5ff]">إجراءات سريعة</h3><p className="mt-0.5 text-[10px] text-[#8aa9be]">تنقل منظم إلى مساحات العمل؛ يتطلب التنفيذ الصلاحية والبيانات الأساسية.</p></div></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{quickActions.map((action) => { const Icon = action.icon; return <button key={action.label} onClick={() => setLocation(action.path)} className="group flex items-center gap-2 rounded-lg border border-white/10 p-2.5 text-right transition hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg,${action.color}df,${action.color}83)` }}><Icon className="h-4 w-4 text-white" /><p className="min-w-0 truncate text-[10px] font-bold text-white">{action.label}</p></button>; })}</div></section>

    <CompanySetupDialog open={setupOpen} onOpenChange={setSetupOpen} onCompleted={() => void companySetup.refetch()} />
  </div>;
}

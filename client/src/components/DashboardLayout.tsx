import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Bell,
  Boxes,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  CircleDollarSign,
  CircleUserRound,
  FileBarChart2,
  FolderKanban,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  ScrollText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";

type NavigationItem = { label: string; path: string; icon: typeof LayoutDashboard };

const commercialNavigation: NavigationItem[] = [
  { label: "الرئيسية", path: "/", icon: LayoutDashboard },
  { label: "المبيعات", path: "/sales", icon: ReceiptText },
  { label: "المشتريات", path: "/purchases", icon: ShoppingCart },
  { label: "المخزون والوقود", path: "/inventory", icon: Boxes },
  { label: "النقد والبنوك", path: "/cash", icon: WalletCards },
  { label: "العمليات", path: "/operations", icon: Truck },
  { label: "المحاسبة العامة", path: "/accounting", icon: Landmark },
  { label: "التقارير والتحليلات", path: "/reports", icon: FileBarChart2 },
];

const enterpriseNavigation: NavigationItem[] = [
  { label: "المشاريع", path: "/projects", icon: FolderKanban },
  { label: "الأصول الثابتة", path: "/assets", icon: Building2 },
  { label: "الموارد البشرية", path: "/hr", icon: UsersRound },
];

const governanceNavigation: NavigationItem[] = [
  { label: "الرقابة والتدقيق", path: "/audit", icon: ScrollText },
  { label: "الإدارة والصلاحيات", path: "/administration", icon: ShieldCheck },
  { label: "الإعدادات", path: "/settings", icon: Settings2 },
];

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "لوحة القيادة", subtitle: "مركز التحكم الإداري والمالي" },
  "/sales": { title: "المبيعات", subtitle: "العملاء والعروض والفواتير والتحصيل" },
  "/purchases": { title: "المشتريات", subtitle: "الموردون وطلبات وأوامر الشراء" },
  "/inventory": { title: "المخزون والوقود", subtitle: "الأصناف والمواقع والحركات التشغيلية" },
  "/cash": { title: "النقد والبنوك", subtitle: "الخزينة والحسابات البنكية والمطابقة" },
  "/operations": { title: "العمليات", subtitle: "الرحلات والتسليمات والاستثناءات" },
  "/accounting": { title: "المحاسبة العامة", subtitle: "الفترات والدفتر العام ضمن بوابة حوكمة" },
  "/reports": { title: "التقارير والتحليلات", subtitle: "رؤية إدارية على بيانات معتمدة" },
  "/projects": { title: "المشاريع", subtitle: "المشروعات والعقود والرقابة على التكلفة" },
  "/assets": { title: "الأصول الثابتة", subtitle: "سجل الأصول والدورات والسياسات" },
  "/hr": { title: "الموارد البشرية", subtitle: "الموظفون والصلاحيات ودورات العمل" },
  "/audit": { title: "الرقابة والتدقيق", subtitle: "الأثر التشغيلي والمخاطر وسجل الأحداث" },
  "/administration": { title: "الإدارة والصلاحيات", subtitle: "الشركة والفروع والمستخدمون والنطاقات" },
  "/settings": { title: "الإعدادات", subtitle: "سياسات النظام والجاهزية والحماية" },
};

function NavigationGroup({ label, items, currentPath, onNavigate }: { label: string; items: NavigationItem[]; currentPath: string; onNavigate: (path: string) => void }) {
  return (
    <section className="mt-4">
      <p className="px-4 pb-2 text-[10px] font-bold tracking-[0.16em] text-[#6c8295]">{label}</p>
      <div className="space-y-1">
        {items.map((item) => {
          const active = item.path === currentPath;
          const Icon = item.icon;
          return <button key={item.path} onClick={() => onNavigate(item.path)} className={`group relative flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-right text-sm transition ${active ? "bg-[linear-gradient(90deg,rgba(34,118,213,0.33),rgba(16,66,121,0.42))] text-white shadow-[inset_0_0_0_1px_rgba(83,165,255,0.24)]" : "text-[#a8bacb] hover:bg-[#122b43] hover:text-[#eaf4ff]"}`}>
            {active ? <span className="absolute right-0 h-5 w-0.5 rounded-l bg-[#42b5ff] shadow-[0_0_12px_#42b5ff]" /> : null}
            <Icon className={`h-4 w-4 ${active ? "text-[#69c4ff]" : "text-[#8198ad] group-hover:text-[#b7e0ff]"}`} />
            <span className="font-semibold">{item.label}</span>
          </button>;
        })}
      </div>
    </section>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading, logout } = useAuth();
  const page = pageTitles[location] ?? pageTitles["/"];
  const navigate = (path: string) => { setLocation(path); setMenuOpen(false); };

  return (
    <div dir="rtl" className="min-h-screen overflow-x-hidden bg-[#061522] text-[#d9e8f5] [background-image:radial-gradient(circle_at_70%_-10%,rgba(26,98,159,0.26),transparent_32%),linear-gradient(rgba(86,147,191,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(86,147,191,0.04)_1px,transparent_1px)] [background-size:auto,32px_32px,32px_32px]">
      {menuOpen ? <button aria-label="إغلاق القائمة" className="fixed inset-0 z-30 bg-[#020912]/75 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`fixed inset-y-0 right-0 z-40 flex w-[278px] flex-col overflow-hidden border-l border-[#1b3b59] bg-[#071a2a] shadow-[-18px_0_50px_rgba(0,0,0,0.3)] transition-transform duration-300 lg:translate-x-0 ${menuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="relative border-b border-[#193650] px-5 py-4 [background-image:radial-gradient(circle_at_20%_10%,rgba(37,128,226,0.22),transparent_42%)]">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <img src="/manus-storage/gray-group-logo-approved_9ac79a93.png" alt="GRAY GROUP — جراي جروب" className="h-auto w-full max-w-[210px] object-contain object-right drop-shadow-[0_5px_16px_rgba(0,0,0,0.4)]" />
              <p className="mt-1 text-[9px] text-[#97adc1]">المنصة الإدارية والرقابية المؤسسية</p>
            </div>
            <button onClick={() => setMenuOpen(false)} className="rounded-lg p-2 text-[#b9cddd] hover:bg-[#15344f] lg:hidden" aria-label="إغلاق القائمة"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <NavigationGroup label="الوحدات الرئيسية" items={commercialNavigation} currentPath={location} onNavigate={navigate} />
          <NavigationGroup label="إدارة المؤسسة" items={enterpriseNavigation} currentPath={location} onNavigate={navigate} />
          <NavigationGroup label="الحوكمة" items={governanceNavigation} currentPath={location} onNavigate={navigate} />
        </nav>
        <div className="m-3 rounded-xl border border-[#27465f] bg-[linear-gradient(145deg,#0d2b42,#0b2134)] p-3.5">
          <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#123752] text-[#74cfff]"><ShieldCheck className="h-4 w-4" /></div><div className="min-w-0"><p className="text-xs font-bold text-[#e7f4ff]">بيئة حوكمة محكومة</p><p className="mt-1 text-[10px] text-[#9cb4c8]">الترحيل المالي: محجوب</p></div></div>
        </div>
      </aside>
      <div className="min-h-screen lg:mr-[278px]">
        <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between border-b border-[#173652]/90 bg-[#071b2d]/85 px-4 py-3 backdrop-blur-xl sm:px-7 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMenuOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#284963] bg-[#0d2a40] text-[#b9dfff] lg:hidden" aria-label="فتح القائمة"><Menu className="h-4 w-4" /></button>
            <div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-semibold text-[#829bb0]"><span className="text-[#5ab7ff]">GRAY GROUP</span><ChevronLeft className="h-3 w-3" /><span>مركز التحكم</span></div><h1 className="mt-1 truncate text-lg font-bold text-[#f2f7fc] sm:text-xl">{page.title}</h1></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-[#23445f] bg-[#0b263a] px-3 py-2 text-[11px] text-[#a8c1d4] xl:flex"><CircleDollarSign className="h-3.5 w-3.5 text-[#68c4ff]" /><span>العملة الأساسية: SAR</span></div>
            <button className="relative grid h-9 w-9 place-items-center rounded-lg border border-[#23445f] bg-[#0b263a] text-[#b8d7ef] hover:bg-[#123752]" aria-label="الإشعارات"><Bell className="h-4 w-4" /><span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#ff7425] shadow-[0_0_9px_#ff7425]" /></button>
            {loading ? <div className="h-9 w-24 animate-pulse rounded-lg bg-[#13324a]" /> : user ? <div className="flex items-center gap-2"><div className="hidden text-left sm:block"><p className="max-w-32 truncate text-xs font-bold text-[#e6f2fb]">{user.name || "مستخدم النظام"}</p><p className="mt-0.5 text-[10px] text-[#7f9bb1]">جلسة مصادق عليها</p></div><button onClick={logout} className="grid h-9 w-9 place-items-center rounded-lg border border-[#23445f] bg-[#0b263a] text-[#b8d7ef] hover:border-[#7c3c42] hover:text-[#ff9b9e]" aria-label="تسجيل الخروج"><LogOut className="h-4 w-4" /></button></div> : <Button onClick={() => startLogin()} className="h-9 rounded-lg bg-[#1475be] px-3 text-xs text-white hover:bg-[#0f5d9a]"><CircleUserRound className="ml-1.5 h-4 w-4" />تسجيل الدخول</Button>}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1840px] px-4 py-5 sm:px-6 lg:px-7">{children}</main>
      </div>
    </div>
  );
}

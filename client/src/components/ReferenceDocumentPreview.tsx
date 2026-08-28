import { AlertTriangle, CalendarDays, CheckSquare, FileText, Landmark, MapPin, ReceiptText, ShieldCheck, UserRound } from "lucide-react";
import type { ReactNode } from "react";

export type ReferenceDocumentKind = "quotation" | "invoice" | "receipt";

const documentCopy: Record<ReferenceDocumentKind, { arabic: string; english: string; number: string; date: string; party: string; counterpart: string; note: string }> = {
  quotation: { arabic: "عرض سعر", english: "QUOTATION", number: "رقم العرض", date: "تاريخ العرض", party: "من / From", counterpart: "إلى / To", note: "هذه معاينة تصميمية لمسودة عرض سعر؛ لا تمثل التزامًا أو اعتمادًا تجاريًا." },
  invoice: { arabic: "فاتورة مبيعات", english: "SALES INVOICE", number: "رقم الفاتورة", date: "تاريخ الفاتورة", party: "من / From", counterpart: "إلى / To", note: "هذه معاينة تصميمية لمسودة فاتورة؛ لا تمثل فاتورة ضريبية أو مستندًا مرحلًا." },
  receipt: { arabic: "سند قبض", english: "RECEIPT VOUCHER", number: "رقم السند", date: "تاريخ السند", party: "استلمنا من", counterpart: "مقابل", note: "هذه معاينة تصميمية لسند قبض؛ لا تنشئ حركة نقدية أو قيدًا محاسبيًا." },
};

function Line({ children }: { children?: ReactNode }) {
  return <div className="min-h-6 border-b border-dashed border-slate-300 py-1 text-[10px] text-slate-500">{children ?? "غير متاح في المعاينة"}</div>;
}

function IconLabel({ icon: Icon, children }: { icon: typeof FileText; children: ReactNode }) {
  return <div className="flex items-center gap-2 text-[10px] font-bold text-slate-800"><Icon className="h-3.5 w-3.5 text-[#f15a24]" />{children}</div>;
}

export default function ReferenceDocumentPreview({ kind, compact = false }: { kind: ReferenceDocumentKind; compact?: boolean }) {
  const copy = documentCopy[kind];
  const isReceipt = kind === "receipt";

  return <section className="overflow-hidden rounded-2xl border border-[#31516a] bg-[#06192a] shadow-[0_20px_44px_rgba(0,0,0,0.24)]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#22455f] bg-[#092840] px-5 py-4">
      <div><p className="text-[10px] font-bold tracking-[0.14em] text-[#ff9057]">GRAY GROUP · REFERENCE TEMPLATE</p><h3 className="mt-1 text-sm font-bold text-[#eff7ff]">معاينة {copy.arabic} بالهوية المعتمدة</h3></div>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#725040] bg-[#38251f] px-2.5 py-1.5 text-[10px] font-bold text-[#ffbd99]"><ShieldCheck className="h-3.5 w-3.5" />معاينة غير معتمدة</span>
    </div>

    <div className={`bg-[#eef1f3] p-3 text-right text-slate-900 sm:p-5 ${compact ? "" : "lg:p-7"}`} dir="rtl">
      <div className="relative overflow-hidden border border-slate-300 bg-white shadow-[0_14px_28px_rgba(20,30,40,0.16)]">
        <div className="absolute right-0 top-0 h-1.5 w-full bg-[#f15a24]" />
        <div className="grid gap-4 p-4 sm:grid-cols-[0.9fr_1.1fr] sm:p-6">
          <div className="relative overflow-hidden bg-[#080b10] px-4 py-5 text-white sm:min-h-40">
            <div className="absolute -left-8 -top-12 h-32 w-32 rotate-45 border-8 border-white/10" />
            <img src="/manus-storage/gray-group-logo-approved_9ac79a93.png" alt="GRAY GROUP" className="relative h-auto w-40 object-contain object-right" />
            <p className="relative mt-4 text-xs tracking-[0.16em] text-[#ff6d2b]">GRAY GROUP</p>
            <p className="relative mt-1 text-[10px] text-slate-300">المنصة الإدارية والرقابية</p>
          </div>
          <div className="flex flex-col justify-between py-1 text-right">
            <div><h4 className="text-2xl font-black text-slate-950 sm:text-3xl">{copy.arabic}</h4><p className="mt-1 text-base font-bold tracking-[0.05em] text-[#f15a24]">{copy.english}</p><div className="mt-3 h-0.5 w-24 bg-[#f15a24]" /></div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-[10px]"><div><IconLabel icon={FileText}>{copy.number}</IconLabel><Line /></div><div><IconLabel icon={CalendarDays}>{copy.date}</IconLabel><Line /></div></div>
          </div>
        </div>

        {isReceipt ? <ReceiptBody copy={copy} /> : <CommercialBody copy={copy} kind={kind} />}

        <div className="border-t border-slate-200 bg-[#090b0f] px-4 py-3 text-[9px] text-white sm:px-6"><div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1"><span className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-[#ff6a29]" />العنوان ووسائل التواصل تُستكمل من إعدادات الشركة المعتمدة</span><span className="text-[#ff8a58]">GRAY GROUP</span></div></div>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#f0b28e] bg-[#fff4ed] px-3 py-2 text-[10px] leading-5 text-[#8b3c20]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{copy.note}</div>
    </div>
  </section>;
}

function CommercialBody({ copy, kind }: { copy: (typeof documentCopy)[ReferenceDocumentKind]; kind: ReferenceDocumentKind }) {
  return <div className="px-4 pb-5 sm:px-6 sm:pb-7">
    <div className="grid gap-3 sm:grid-cols-2"><PartyBox title={copy.party} icon={Landmark} fields={["اسم الشركة", "العنوان", "الشخص المسؤول", "الهاتف والبريد"]} /><PartyBox title={copy.counterpart} icon={UserRound} fields={[kind === "quotation" ? "اسم العميل أو الجهة" : "اسم العميل", "العنوان", "الشخص المسؤول", "الهاتف والبريد"]} /></div>
    <p className="mt-5 text-xs font-bold text-slate-900">المحترمين،</p><p className="mt-1 text-[10px] leading-5 text-slate-600">تفاصيل البنود تُظهر فقط البيانات المرتبطة بالمسودة عند إنشائها. هذه المعاينة لا تُظهر قيمًا افتراضية أو غير موثقة.</p>
    <div className="mt-4 overflow-x-auto border border-slate-300"><table className="w-full min-w-[560px] text-[10px]"><thead className="bg-[#090b0f] text-white"><tr><th className="p-2">م</th><th className="p-2 text-right">الصنف / البيان</th><th className="p-2">الكمية</th><th className="p-2">الوحدة</th><th className="p-2">سعر الوحدة</th><th className="p-2">الإجمالي</th></tr></thead><tbody>{Array.from({ length: 4 }, (_, index) => <tr key={index} className="border-t border-slate-200"><td className="p-2 text-center text-slate-500">{index + 1}</td><td className="p-2"><div className="h-3 w-full rounded bg-slate-100" /></td><td className="p-2"><div className="h-3 rounded bg-slate-100" /></td><td className="p-2"><div className="h-3 rounded bg-slate-100" /></td><td className="p-2"><div className="h-3 rounded bg-slate-100" /></td><td className="p-2"><div className="h-3 rounded bg-slate-100" /></td></tr>)}</tbody></table></div>
    <div className="mt-4 grid gap-4 sm:grid-cols-[0.78fr_1.22fr]"><div className="overflow-hidden rounded border border-slate-300 text-[10px]"><SummaryRow label="الإجمالي الفرعي" /><SummaryRow label="الضريبة" /><SummaryRow label="الإجمالي الكلي" strong /><SummaryRow label="الرصيد المستحق" orange /></div><div className="space-y-3"><NoteLines label="ملاحظات" /><NoteLines label="الشروط والأحكام" /></div></div>
  </div>;
}

function ReceiptBody({ copy }: { copy: (typeof documentCopy)[ReferenceDocumentKind] }) {
  return <div className="px-4 pb-5 sm:px-6 sm:pb-7"><div className="grid gap-3 sm:grid-cols-3"><PartyBox title={copy.party} icon={UserRound} fields={["اسم العميل", "الشركة", "الهاتف"]} /><div className="rounded border border-slate-300 p-3 sm:col-span-2"><p className="border-b border-slate-900 pb-2 text-xs font-black">المبلغ المستلم / AMOUNT RECEIVED</p><div className="mt-3 rounded border border-[#f15a24] py-5 text-center text-xl font-black text-[#f15a24]">—</div><p className="mt-3 text-[10px] font-bold">المبلغ كتابة</p><Line /></div></div><div className="mt-3 rounded border border-slate-300 p-3"><IconLabel icon={ReceiptText}>{copy.counterpart}</IconLabel><Line>تفصيل العملية المرتبطة بالمسودة أو الحركة الموثقة فقط.</Line></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><SummaryRow label="الرصيد السابق" /><SummaryRow label="المبلغ المستلم" /><SummaryRow label="الرصيد المتبقي" /></div><div className="mt-4 grid gap-3 sm:grid-cols-3 text-center text-[10px]"><Stamp label="استلم بواسطة" /><Stamp label="التوقيع" /><Stamp label="ختم الشركة" /></div></div>;
}

function PartyBox({ title, icon: Icon, fields }: { title: string; icon: typeof Landmark; fields: string[] }) { return <div className="rounded border border-slate-300 p-3"><p className="mb-2 flex items-center gap-1.5 border-b border-slate-900 pb-2 text-xs font-black"><Icon className="h-3.5 w-3.5 text-[#f15a24]" />{title}</p><div className="space-y-1.5">{fields.map((field) => <div key={field} className="grid grid-cols-[0.9fr_1.1fr] gap-2 text-[10px]"><span className="font-bold text-slate-700">{field}</span><Line /></div>)}</div></div>; }
function SummaryRow({ label, strong, orange }: { label: string; strong?: boolean; orange?: boolean }) { return <div className={`flex items-center justify-between border-b border-slate-200 px-3 py-2 ${orange ? "bg-[#f15a24] text-white" : strong ? "bg-slate-100 font-black" : ""}`}><span>{label}</span><span>—</span></div>; }
function NoteLines({ label }: { label: string }) { return <div><p className="mb-1 flex items-center gap-1.5 text-[11px] font-black text-[#f15a24]"><CheckSquare className="h-3.5 w-3.5 text-slate-900" />{label}</p><div className="space-y-2 border-b border-dashed border-slate-300 pb-2"><Line /><Line /></div></div>; }
function Stamp({ label }: { label: string }) { return <div className="rounded border border-dashed border-slate-400 px-2 py-4"><p className="font-bold">{label}</p><div className="mt-5 border-b border-slate-400" /></div>; }

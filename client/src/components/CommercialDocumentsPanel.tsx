import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import ReferenceDocumentPreview, { type ReferenceDocumentKind } from "@/components/ReferenceDocumentPreview";
import { Building2, CheckCircle2, FilePenLine, Loader2, Minus, PackagePlus, Plus, Printer, Send, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type DocumentArea = "sales" | "purchases";
type DocumentRow = { id: number; kind: string; status: string; documentNumber: string; documentDate: Date; currency: string; totalAmount: string; createdAt: Date };
type Item = { id: number; itemCode: string; name: string; unitOfMeasure: string };
type LineDraft = { id: string; itemId: string; description: string; quantity: string; unitPrice: string; taxRate: string };
type PrintableDocument = {
  company: { legalName: string; companyCode: string };
  branch: { branchCode: string; name: string };
  document: { kind: string; status: string; documentNumber: string; documentDate: Date; dueDate: Date | null; currency: string; subtotal: string; taxAmount: string; totalAmount: string; notes: string | null };
  party: { legalName: string; taxNumber: string | null; phone: string | null; email: string | null } | null;
  lines: { lineNumber: number; description: string; quantity: string; unitPrice: string; taxRate: string; lineTotal: string }[];
  printScope: "operational_live_copy";
};
const auditReadPermission = { permission: "audit.read" as const };
const labels = {
  sales: { title: "مستندات المبيعات", create: "مسودة مبيعات", kinds: { quotation: "عرض سعر", sales_invoice: "فاتورة مبيعات" } },
  purchases: { title: "مستندات المشتريات", create: "مسودة مشتريات", kinds: { purchase_request: "طلب شراء", purchase_order: "أمر شراء" } },
} as const;
const inputClass = "h-10 w-full rounded-lg border border-[#24506e] bg-[#0a2941] px-3 text-sm text-[#e6f4ff] outline-none placeholder:text-[#57768d] focus:border-[#54b9f4]";

function isoToday() { return new Date().toISOString().slice(0, 10); }
function newLine(): LineDraft { return { id: crypto.randomUUID(), itemId: "", description: "", quantity: "1", unitPrice: "0", taxRate: "0" }; }
function number(value: string) { return Number(value) || 0; }
const statusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: "مسودة", className: "bg-[#3e3820] text-[#f0d37a]" },
  in_review: { label: "قيد المراجعة", className: "bg-[#173b58] text-[#82caff]" },
  approved: { label: "مقبول تشغيليًا", className: "bg-[#174a37] text-[#9ce7bd]" },
  cancelled: { label: "ملغى", className: "bg-[#48272b] text-[#ffaaa3]" },
};
const liveKindLabels: Record<string, string> = { quotation: "عرض سعر", sales_invoice: "فاتورة مبيعات", purchase_request: "طلب شراء", purchase_order: "أمر شراء" };
function printNumber(value: string | number) { return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(Number(value)); }
function escapePrint(value: unknown) { return String(value ?? "—").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char); }
function printLiveDocument(payload: PrintableDocument, printWindow: Window) {
  const date = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(payload.document.documentDate));
  const due = payload.document.dueDate ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(payload.document.dueDate)) : "—";
  const rows = payload.lines.map((line) => `<tr><td>${line.lineNumber}</td><td>${escapePrint(line.description)}</td><td>${escapePrint(line.quantity)}</td><td>${printNumber(line.unitPrice)}</td><td>${escapePrint(line.taxRate)}%</td><td>${printNumber(line.lineTotal)}</td></tr>`).join("");
  printWindow.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapePrint(payload.document.documentNumber)} — نسخة تشغيلية</title><style>body{font-family:Tahoma,Arial,sans-serif;color:#122535;margin:34px;background:#fff}.head{display:flex;justify-content:space-between;border-bottom:3px solid #f36e35;padding-bottom:18px}.brand{font-weight:800;font-size:22px}.muted{color:#5c7282;font-size:12px}.warning{margin:18px 0;padding:11px 14px;border:1px solid #e6a96f;background:#fff8ee;color:#815321;font-size:12px;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.box{border:1px solid #cbd8df;padding:12px;font-size:13px}.box b{display:block;margin-bottom:6px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:15px 0;font-size:13px}.meta div{background:#f4f8fa;padding:9px;border-radius:4px}table{border-collapse:collapse;width:100%;font-size:12px;margin-top:16px}th{background:#112d42;color:#fff}th,td{border:1px solid #c6d3db;padding:9px;text-align:right}.total{margin-top:16px;margin-right:auto;width:310px;border:1px solid #cbd8df}.total div{display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #d9e2e7}.total div:last-child{border:0;background:#f36e35;color:white;font-weight:800}.notes{margin-top:18px;border-top:1px solid #d5e0e5;padding-top:10px;font-size:12px}.footer{margin-top:30px;padding-top:10px;border-top:1px solid #d5e0e5;font-size:10px;color:#5c7282}@media print{body{margin:15mm}.warning{break-inside:avoid}}</style></head><body><header class="head"><div><div class="brand">${escapePrint(payload.company.legalName)}</div><div class="muted">${escapePrint(payload.company.companyCode)} · ${escapePrint(payload.branch.branchCode)} — ${escapePrint(payload.branch.name)}</div></div><div><b>${escapePrint(liveKindLabels[payload.document.kind] ?? payload.document.kind)}</b><div class="muted">رقم: ${escapePrint(payload.document.documentNumber)}</div></div></header><div class="warning">نسخة تشغيلية حية للطباعة أو الحفظ PDF. لا تمثل اعتمادًا ماليًا أو قيدًا أو تحصيلًا أو تفويضًا بالدفع.</div><section class="grid"><div class="box"><b>${payload.document.kind.startsWith("purchase") ? "المورد" : "العميل"}</b>${escapePrint(payload.party?.legalName)}<br><span class="muted">رقم ضريبي: ${escapePrint(payload.party?.taxNumber)} · هاتف: ${escapePrint(payload.party?.phone)}</span></div><div class="box"><b>حالة المستند</b>${escapePrint(statusLabels[payload.document.status]?.label ?? payload.document.status)}<br><span class="muted">تاريخ الاستحقاق: ${escapePrint(due)}</span></div></section><section class="meta"><div><b>تاريخ المستند</b><br>${escapePrint(date)}</div><div><b>العملة</b><br>${escapePrint(payload.document.currency)}</div><div><b>نطاق النسخة</b><br>تشغيلي حي ومدقق</div></section><table><thead><tr><th>#</th><th>الوصف</th><th>الكمية</th><th>سعر الوحدة</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table><section class="total"><div><span>الإجمالي الفرعي</span><b>${printNumber(payload.document.subtotal)} ${escapePrint(payload.document.currency)}</b></div><div><span>الضريبة</span><b>${printNumber(payload.document.taxAmount)} ${escapePrint(payload.document.currency)}</b></div><div><span>الإجمالي</span><b>${printNumber(payload.document.totalAmount)} ${escapePrint(payload.document.currency)}</b></div></section>${payload.document.notes ? `<section class="notes"><b>ملاحظات تشغيلية</b><br>${escapePrint(payload.document.notes)}</section>` : ""}<footer class="footer">أُنشئت هذه النسخة من بيانات GRAY ERP الحية مع أثر تصدير في سجل التدقيق. حظر الترحيل المالي قائم.</footer></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 200);
}

export default function CommercialDocumentsPanel({ area, accessDenied, accessResolved }: { area: DocumentArea; accessDenied: boolean; accessResolved: boolean }) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [creating, setCreating] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [kind, setKind] = useState(area === "sales" ? "quotation" : "purchase_request");
  const [documentDate, setDocumentDate] = useState(isoToday());
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [lastDocumentId, setLastDocumentId] = useState<number | null>(null);
  const [previewKind, setPreviewKind] = useState<ReferenceDocumentKind>("quotation");
  const companySetup = trpc.erp.setup.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const hasCompany = Boolean(companySetup.data);
  const enabled = isAuthenticated && accessResolved && !accessDenied && hasCompany;
  const sales = trpc.erp.documents.sales.list.useQuery(undefined, { enabled: enabled && area === "sales", retry: false });
  const purchases = trpc.erp.documents.purchases.list.useQuery(undefined, { enabled: enabled && area === "purchases", retry: false });
  const branches = trpc.erp.organization.branches.list.useQuery(undefined, { enabled, retry: false });
  const customers = trpc.erp.masterData.customers.list.useQuery(undefined, { enabled: enabled && area === "sales", retry: false });
  const suppliers = trpc.erp.masterData.suppliers.list.useQuery(undefined, { enabled: enabled && area === "purchases", retry: false });
  const items = trpc.erp.documents.items.list.useQuery(undefined, { enabled, retry: false });
  const auditMay = trpc.erp.may.useQuery(auditReadPermission, { enabled: isAuthenticated });
  const audit = trpc.erp.audit.list.useQuery(undefined, { enabled: Boolean(enabled && auditMay.data?.allowed && lastDocumentId), retry: false });
  const query = area === "sales" ? sales : purchases;
  const rows = query.data as DocumentRow[] | undefined;
  const setupRequired = isAuthenticated && companySetup.isSuccess && !hasCompany;
  const copy = labels[area];
  const format = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 });
  const totals = useMemo(() => lines.reduce((acc, line) => {
    const net = number(line.quantity) * number(line.unitPrice);
    const tax = net * (number(line.taxRate) / 100);
    return { subtotal: acc.subtotal + net, tax: acc.tax + tax, total: acc.total + net + tax };
  }, { subtotal: 0, tax: 0, total: 0 }), [lines]);

  useEffect(() => { if (!branchId && branches.data?.[0]?.id) setBranchId(String(branches.data[0].id)); }, [branchId, branches.data]);
  useEffect(() => { setKind(area === "sales" ? "quotation" : "purchase_request"); setPreviewKind(area === "sales" ? "quotation" : "invoice"); }, [area]);

  const salesCreate = trpc.erp.documents.sales.createDraft.useMutation({
    onSuccess: async (data) => { setLastDocumentId(data.documentId); toast.success("أُنشئت المسودة مع بنودها وإجمالياتها وسُجل أثر التدقيق. لا تمثل اعتمادًا أو ترحيلًا."); await Promise.all([utils.erp.documents.sales.list.invalidate(), utils.erp.audit.list.invalidate()]); reset(); },
    onError: (error) => toast.error(error.message),
  });
  const purchasesCreate = trpc.erp.documents.purchases.createDraft.useMutation({
    onSuccess: async (data) => { setLastDocumentId(data.documentId); toast.success("أُنشئت المسودة مع بنودها وإجمالياتها وسُجل أثر التدقيق. لا تمثل اعتمادًا أو ترحيلًا."); await Promise.all([utils.erp.documents.purchases.list.invalidate(), utils.erp.audit.list.invalidate()]); reset(); },
    onError: (error) => toast.error(error.message),
  });
  const salesStatus = trpc.erp.documents.sales.updateStatus.useMutation({
    onSuccess: async (data) => { setLastDocumentId(data.documentId); toast.success(data.status === "in_review" ? "أُرسل المستند للمراجعة التشغيلية." : data.status === "approved" ? "سُجل القرار التشغيلي مع أثر تدقيق. لا يمثل اعتمادًا ماليًا أو ترحيلًا." : "أُلغي المستند مع توثيق السبب."); await Promise.all([utils.erp.documents.sales.list.invalidate(), utils.erp.audit.list.invalidate()]); },
    onError: (error) => toast.error(error.message),
  });
  const purchasesStatus = trpc.erp.documents.purchases.updateStatus.useMutation({
    onSuccess: async (data) => { setLastDocumentId(data.documentId); toast.success(data.status === "in_review" ? "أُرسل المستند للمراجعة التشغيلية." : data.status === "approved" ? "سُجل القرار التشغيلي مع أثر تدقيق. لا يمثل اعتمادًا ماليًا أو ترحيلًا." : "أُلغي المستند مع توثيق السبب."); await Promise.all([utils.erp.documents.purchases.list.invalidate(), utils.erp.audit.list.invalidate()]); },
    onError: (error) => toast.error(error.message),
  });
  const salesPrint = trpc.erp.documents.sales.recordPrint.useMutation({ onError: (error) => toast.error(error.message) });
  const purchasesPrint = trpc.erp.documents.purchases.recordPrint.useMutation({ onError: (error) => toast.error(error.message) });
  const saving = salesCreate.isPending || purchasesCreate.isPending || salesStatus.isPending || purchasesStatus.isPending || salesPrint.isPending || purchasesPrint.isPending;

  function reset() { setCreating(false); setBranchId(""); setPartnerId(""); setDocumentNumber(""); setKind(area === "sales" ? "quotation" : "purchase_request"); setDocumentDate(isoToday()); setDueDate(""); setCurrency("SAR"); setNotes(""); setLines([newLine()]); }
  function updateLine(id: string, field: keyof Omit<LineDraft, "id">, value: string) {
    setLines((current) => current.map((line) => {
      if (line.id !== id) return line;
      if (field === "itemId") {
        const selected = (items.data as Item[] | undefined)?.find((item) => item.id === Number(value));
        return { ...line, itemId: value, description: selected ? selected.name : line.description };
      }
      return { ...line, [field]: value };
    }));
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const preparedLines = lines.map(({ itemId, description, quantity, unitPrice, taxRate }) => ({ itemId: itemId ? Number(itemId) : undefined, description: description.trim(), quantity: Number(quantity), unitPrice: Number(unitPrice), taxRate: Number(taxRate) }));
    if (preparedLines.some((line) => !line.description || line.quantity <= 0 || line.unitPrice < 0 || line.taxRate < 0 || line.taxRate > 100)) { toast.error("تحقق من وصف كل بند وكميته وسعره وضريبته قبل الحفظ."); return; }
    const base = { branchId: Number(branchId), documentNumber, documentDate: new Date(`${documentDate}T00:00:00`), dueDate: dueDate ? new Date(`${dueDate}T00:00:00`) : undefined, currency, notes: notes.trim() || undefined, lines: preparedLines };
    if (area === "sales") salesCreate.mutate({ ...base, kind: kind as "quotation" | "sales_invoice", customerId: Number(partnerId) });
    else purchasesCreate.mutate({ ...base, kind: kind as "purchase_request" | "purchase_order", supplierId: Number(partnerId) });
  }
  function updateStatus(documentId: number, nextStatus: "in_review" | "approved" | "cancelled") {
    const reason = nextStatus === "cancelled" ? window.prompt("سبب الإلغاء التشغيلي (حرفان على الأقل):")?.trim() : undefined;
    if (nextStatus === "cancelled" && !reason) return;
    const input = { documentId, nextStatus, reason };
    if (area === "sales") salesStatus.mutate(input);
    else purchasesStatus.mutate(input);
  }
  function openPrint(documentId: number) {
    const printWindow = window.open("", "_blank", "width=980,height=760");
    if (!printWindow) { toast.error("تعذر فتح نافذة الطباعة. تحقق من مانع النوافذ المنبثقة ثم أعد المحاولة."); return; }
    const onSuccess = async (payload: PrintableDocument) => { setLastDocumentId(documentId); printLiveDocument(payload, printWindow); toast.success("تم إنشاء نسخة حية للطباعة وتسجيل أثر التصدير."); await utils.erp.audit.list.invalidate(); };
    const onError = (error: { message: string }) => { printWindow.close(); toast.error(error.message); };
    if (area === "sales") salesPrint.mutate({ documentId }, { onSuccess, onError });
    else purchasesPrint.mutate({ documentId }, { onSuccess, onError });
  }

  return <><div className="rounded-2xl border border-[#1c4563] bg-[#092238] shadow-[0_18px_42px_rgba(0,0,0,0.15)]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#193f5d] px-5 py-4 sm:px-6"><div><h3 className="text-sm font-bold text-[#e6f2fc]">{copy.title}</h3><p className="mt-1 text-[10px] text-[#7899af]">بنود وإجماليات وحالات مراجعة تشغيلية مدققة؛ لا تفويض مالي، ولا تسليم، ولا ترحيل محاسبي.</p></div><Button onClick={() => setCreating((value) => !value)} disabled={!enabled || setupRequired || !branches.data?.length} className="h-9 rounded-lg bg-[#1d7dc2] px-3 text-xs text-white hover:bg-[#176aa7] disabled:opacity-50"><Plus className="ml-1 h-3.5 w-3.5" />{copy.create}</Button></div>
    {creating ? <form onSubmit={submit} className="space-y-4 border-b border-[#193f5d] bg-[#071d30] px-5 py-5 sm:px-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Field label="الفرع"><select value={branchId} onChange={(event) => setBranchId(event.target.value)} required className={inputClass}><option value="">اختر الفرع</option>{branches.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} — {branch.name}</option>)}</select></Field><Field label={area === "sales" ? "العميل" : "المورد"}><select value={partnerId} onChange={(event) => setPartnerId(event.target.value)} required className={inputClass}><option value="">{area === "sales" ? "اختر العميل" : "اختر المورد"}</option>{area === "sales" ? customers.data?.map((customer) => <option key={customer.id} value={customer.id}>{customer.customerCode} — {customer.legalName}</option>) : suppliers.data?.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplierCode} — {supplier.legalName}</option>)}</select></Field><Field label="نوع المستند"><select value={kind} onChange={(event) => setKind(event.target.value)} className={inputClass}>{Object.entries(copy.kinds).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></Field><Field label="رقم المستند"><input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value.toUpperCase())} required pattern="[A-Za-z0-9_-]{2,64}" className={inputClass} placeholder="SAL-0001" /></Field></div>
      <div className="grid gap-3 sm:grid-cols-3"><Field label="تاريخ المستند"><input value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} required type="date" className={inputClass} /></Field><Field label="تاريخ الاستحقاق"><input value={dueDate} onChange={(event) => setDueDate(event.target.value)} min={documentDate} type="date" className={inputClass} /></Field><Field label="العملة"><input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} required pattern="[A-Za-z]{3}" maxLength={3} className={inputClass} /></Field></div>
      <div className="overflow-hidden rounded-xl border border-[#1b4663]"><div className="flex items-center justify-between border-b border-[#1b4663] bg-[#0a2941] px-3 py-2"><p className="text-xs font-bold text-[#dcedf9]">بنود المستند</p><Button type="button" onClick={() => setLines((current) => [...current, newLine()])} variant="outline" className="h-7 border-[#2b5a79] bg-[#10334c] px-2 text-[10px] text-[#bde2f6] hover:bg-[#17435f] hover:text-white"><PackagePlus className="ml-1 h-3 w-3" />إضافة بند</Button></div><div className="space-y-2 p-3">{lines.map((line, index) => <div key={line.id} className="grid gap-2 rounded-lg border border-[#173d58] bg-[#082236] p-2 md:grid-cols-[1.1fr_1.5fr_0.55fr_0.65fr_0.5fr_32px]"><select aria-label={`الصنف ${index + 1}`} value={line.itemId} onChange={(event) => updateLine(line.id, "itemId", event.target.value)} className={inputClass}><option value="">صنف اختياري</option>{(items.data as Item[] | undefined)?.map((item) => <option key={item.id} value={item.id}>{item.itemCode} — {item.name}</option>)}</select><input aria-label={`وصف البند ${index + 1}`} value={line.description} onChange={(event) => updateLine(line.id, "description", event.target.value)} required minLength={2} maxLength={500} className={inputClass} placeholder="وصف البند" /><input aria-label={`كمية البند ${index + 1}`} value={line.quantity} onChange={(event) => updateLine(line.id, "quantity", event.target.value)} required min="0.001" step="0.001" type="number" className={inputClass} placeholder="الكمية" /><input aria-label={`سعر وحدة البند ${index + 1}`} value={line.unitPrice} onChange={(event) => updateLine(line.id, "unitPrice", event.target.value)} required min="0" step="0.01" type="number" className={inputClass} placeholder="السعر" /><input aria-label={`ضريبة البند ${index + 1}`} value={line.taxRate} onChange={(event) => updateLine(line.id, "taxRate", event.target.value)} required min="0" max="100" step="0.01" type="number" className={inputClass} placeholder="% ضريبة" /><Button type="button" onClick={() => setLines((current) => current.length > 1 ? current.filter((candidate) => candidate.id !== line.id) : current)} disabled={lines.length === 1} variant="ghost" className="h-10 w-8 px-0 text-[#e67f76] hover:bg-[#442325] hover:text-[#ffb1a8]"><Trash2 className="h-4 w-4" /></Button><p className="md:col-span-6 text-left font-mono text-[10px] text-[#91b8cf]">إجمالي البند: {format.format(number(line.quantity) * number(line.unitPrice) * (1 + number(line.taxRate) / 100))} {currency}</p></div>)}</div></div>
      <div className="grid gap-3 md:grid-cols-[1fr_300px]"><Field label="ملاحظات تشغيلية"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={4000} className="min-h-24 w-full rounded-lg border border-[#24506e] bg-[#0a2941] px-3 py-2 text-sm text-[#e6f4ff] outline-none focus:border-[#54b9f4]" placeholder="ملاحظات غير محاسبية للمسودة" /></Field><div className="rounded-xl border border-[#24506e] bg-[#0a2941] p-3 text-xs"><p className="font-bold text-[#cde9fa]">ملخص الإجماليات</p><p className="mt-2 flex justify-between text-[#8fb3c9]"><span>الإجمالي الفرعي</span><span className="font-mono text-[#e4f3ff]">{format.format(totals.subtotal)} {currency}</span></p><p className="mt-2 flex justify-between text-[#8fb3c9]"><span>الضريبة</span><span className="font-mono text-[#e4f3ff]">{format.format(totals.tax)} {currency}</span></p><p className="mt-2 flex justify-between border-t border-[#28506d] pt-2 font-bold text-[#ffb585]"><span>الإجمالي المتوقع</span><span className="font-mono">{format.format(totals.total)} {currency}</span></p></div></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-1.5 text-[10px] leading-5 text-[#f0c580]"><ShieldAlert className="h-3.5 w-3.5" />تتحقق الخدمة من البنود والإجماليات وتحفظها كمسودة مدققة فقط.</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={reset} disabled={saving} className="h-9 rounded-lg border-[#254c67] bg-[#0a2941] text-xs text-[#bdd8eb] hover:bg-[#11344e] hover:text-white">إلغاء</Button><Button type="submit" disabled={saving || !branchId || !partnerId} className="h-9 rounded-lg bg-[#1d7dc2] text-xs text-white hover:bg-[#176aa7]">{saving ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : <FilePenLine className="ml-1 h-3.5 w-3.5" />}حفظ المسودة</Button></div></div>
    </form> : null}
    <div className="min-h-[250px] px-5 py-5 sm:px-6">{query.isLoading ? <State icon={<Loader2 className="h-5 w-5 animate-spin" />} title="جارٍ تحميل المستندات…" /> : null}{setupRequired ? <State icon={<Building2 className="h-5 w-5" />} title="يلزم تهيئة الشركة أولًا" detail="أنشئ نطاق الشركة قبل إنشاء أو قراءة أي مسودة تجارية." warm /> : null}{query.error && !setupRequired ? <State icon={<ShieldAlert className="h-5 w-5" />} title="تعذر الوصول إلى سجل المستندات" detail={query.error.message} warm /> : null}{!query.isLoading && !query.error && (!rows || rows.length === 0) ? <State icon={<FilePenLine className="h-5 w-5" />} title="لا توجد مسودات تشغيلية" detail={branches.data?.length ? "أضف مسودة بعد اختيار الفرع والطرف والبنود من القوائم المعتمدة." : "لا يوجد فرع نشط. اطلب من مدير النظام إنشاء فرع أو أكمل تهيئة الشركة."} /> : null}{!query.isLoading && !query.error && rows && rows.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[840px] text-right"><thead><tr className="border-b border-[#193f5d] text-[11px] text-[#82a4b9]"><th className="pb-3 font-semibold">الرقم</th><th className="pb-3 font-semibold">النوع</th><th className="pb-3 font-semibold">التاريخ</th><th className="pb-3 font-semibold">الإجمالي</th><th className="pb-3 font-semibold">الحالة</th><th className="pb-3 font-semibold">إجراء</th></tr></thead><tbody>{rows.map((row) => { const status = statusLabels[row.status] ?? statusLabels.draft; return <tr key={row.id} className="border-b border-[#123650] text-sm text-[#c4dcec]"><td className="py-3 font-mono text-xs">{row.documentNumber}</td><td className="py-3 text-xs">{(copy.kinds as Record<string, string>)[row.kind] ?? row.kind}</td><td className="py-3 text-xs text-[#91b2c9]">{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(row.documentDate))}</td><td className="py-3 font-mono text-xs">{format.format(Number(row.totalAmount))} {row.currency}</td><td className="py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${status.className}`}>{status.label}</span></td><td className="py-3"><div className="flex flex-wrap gap-1.5"><Button type="button" onClick={() => openPrint(row.id)} disabled={saving} variant="outline" className="h-7 border-[#5d5a34] bg-[#3b351d] px-2 text-[10px] text-[#f5dc91] hover:bg-[#504724] hover:text-white"><Printer className="ml-1 h-3 w-3" />طباعة / PDF</Button>{row.status === "draft" ? <Button type="button" onClick={() => updateStatus(row.id, "in_review")} disabled={saving} variant="outline" className="h-7 border-[#2c6690] bg-[#103957] px-2 text-[10px] text-[#bce6ff] hover:bg-[#185072] hover:text-white"><Send className="ml-1 h-3 w-3" />إرسال للمراجعة</Button> : null}{row.status === "in_review" ? <><Button type="button" onClick={() => updateStatus(row.id, "approved")} disabled={saving} variant="outline" className="h-7 border-[#2c7051] bg-[#103d30] px-2 text-[10px] text-[#b7f2cf] hover:bg-[#17523d] hover:text-white"><CheckCircle2 className="ml-1 h-3 w-3" />قرار تشغيلي</Button><Button type="button" onClick={() => updateStatus(row.id, "cancelled")} disabled={saving} variant="outline" className="h-7 border-[#75403f] bg-[#452728] px-2 text-[10px] text-[#ffc0ba] hover:bg-[#5c3130] hover:text-white"><XCircle className="ml-1 h-3 w-3" />إلغاء</Button></> : null}</div></td></tr>; })}</tbody></table><p className="mt-3 text-[10px] leading-5 text-[#d7ad72]">الطباعة تنشئ نسخة حية قابلة للحفظ PDF وتسجل أثر تصدير ملحقًا. قرار الحالة هنا تشغيلي داخلي فقط؛ لا ينشئ أي إجراء قيدًا أو تحصيلًا أو التزامًا ماليًا.</p></div> : null}{lastDocumentId && auditMay.data?.allowed ? <div className="mt-4 rounded-xl border border-[#1e553e] bg-[#082d26] px-4 py-3 text-xs text-[#9bdfbf]"><p className="font-bold">أثر التدقيق للمستند #{lastDocumentId}</p><p className="mt-1 text-[#87ba9f]">{audit.isLoading ? "جارٍ تحميل أثر التغيير…" : audit.data?.some((event) => event.entityType === "commercial_document" && event.entityId === String(lastDocumentId)) ? "تم التحقق من أثر المستند في سجل التدقيق الملحق." : "سيظهر أثر التغيير عند اكتمال تحديث سجل التدقيق."}</p></div> : null}</div>
  </div>{area === "sales" ? <div className="mt-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-[#bfdae9]">قوالب مرجعية للمسودات</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setPreviewKind("quotation")} className={`h-8 rounded-lg border text-[10px] ${previewKind === "quotation" ? "border-[#f27a43] bg-[#452c22] text-[#ffb795]" : "border-[#28506d] bg-[#0b283e] text-[#a7c9df]"}`}>عرض سعر</Button><Button type="button" variant="outline" onClick={() => setPreviewKind("invoice")} className={`h-8 rounded-lg border text-[10px] ${previewKind === "invoice" ? "border-[#f27a43] bg-[#452c22] text-[#ffb795]" : "border-[#28506d] bg-[#0b283e] text-[#a7c9df]"}`}>فاتورة مبيعات</Button></div></div><ReferenceDocumentPreview kind={previewKind} compact /></div> : null}</>;
}

function State({ icon, title, detail, warm }: { icon: React.ReactNode; title: string; detail?: string; warm?: boolean }) { return <div className={`flex h-[190px] flex-col items-center justify-center text-center ${warm ? "text-[#efc97c]" : "text-[#6ec9ff]"}`}><div className={`grid h-11 w-11 place-items-center rounded-xl border ${warm ? "border-[#5b4a2e] bg-[#2d261c]" : "border-[#24506e] bg-[#0a2941]"}`}>{icon}</div><h4 className="mt-3 text-sm font-bold text-[#dcecf8]">{title}</h4>{detail ? <p className="mt-1 max-w-sm text-xs leading-5 text-[#8eafc5]">{detail}</p> : null}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1"><span className="text-[11px] font-bold text-[#a7c5da]">{label}</span>{children}</label>; }

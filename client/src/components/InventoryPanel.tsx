import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Boxes, Building2, ClipboardList, Loader2, MapPin, PackagePlus, Plus, RefreshCw, Scale } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";

type PanelTab = "locations" | "movements";
type Direction = "transfer";
type MovementMode = "transfer" | "approved_document" | "stock_count";

const directionMeta: Record<"in" | "out" | "transfer" | "adjustment", { label: string; icon: typeof ArrowDownToLine; tone: string }> = {
  in: { label: "إدخال", icon: ArrowDownToLine, tone: "bg-[#123e38] text-[#76e1c9]" },
  out: { label: "إخراج", icon: ArrowUpFromLine, tone: "bg-[#4d2e31] text-[#ffaaa1]" },
  transfer: { label: "تحويل", icon: ArrowLeftRight, tone: "bg-[#27395a] text-[#a8c9ff]" },
  adjustment: { label: "تسوية موجبة", icon: Scale, tone: "bg-[#4b3b21] text-[#f5ca77]" },
};

const locationTypeLabels = { warehouse: "مستودع", ground_tank: "خزان أرضي", tanker: "ناقلة" } as const;

function formatQuantity(value: string | number) {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 3 }).format(Number(value));
}

export default function InventoryPanel({ accessDenied, accessResolved }: { accessDenied: boolean; accessResolved: boolean }) {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<PanelTab>("locations");
  const [showCreate, setShowCreate] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationType, setLocationType] = useState<keyof typeof locationTypeLabels>("warehouse");
  const [capacity, setCapacity] = useState("");
  const [itemId, setItemId] = useState("");
  const [direction, setDirection] = useState<Direction>("transfer");
  const [movementMode, setMovementMode] = useState<MovementMode>("transfer");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [referenceType, setReferenceType] = useState("سند تشغيلي");
  const [referenceId, setReferenceId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [adjustmentKind, setAdjustmentKind] = useState<"increase" | "decrease">("increase");
  const [countReference, setCountReference] = useState("");

  const companySetup = trpc.erp.setup.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const hasCompany = Boolean(companySetup.data);
  const setupRequired = isAuthenticated && companySetup.isSuccess && !hasCompany;
  const queryEnabled = isAuthenticated && accessResolved && !accessDenied && hasCompany;
  const branches = trpc.erp.organization.branches.list.useQuery(undefined, { enabled: queryEnabled });
  const items = trpc.erp.masterData.items.list.useQuery(undefined, { enabled: queryEnabled });
  const locations = trpc.erp.inventory.locations.list.useQuery(undefined, { enabled: queryEnabled });
  const movements = trpc.erp.inventory.movements.list.useQuery(undefined, { enabled: queryEnabled });
  const salesDocuments = trpc.erp.documents.sales.list.useQuery(undefined, { enabled: queryEnabled, retry: false });
  const purchaseDocuments = trpc.erp.documents.purchases.list.useQuery(undefined, { enabled: queryEnabled, retry: false });
  const activeBranchId = branchId || String(branches.data?.[0]?.id ?? "");
  const selectedLocations = useMemo(() => locations.data?.filter((location) => !activeBranchId || location.branchId === Number(activeBranchId)) ?? [], [locations.data, activeBranchId]);
  const selectedMovements = useMemo(() => movements.data?.filter((movement) => !activeBranchId || movement.branchId === Number(activeBranchId)) ?? [], [movements.data, activeBranchId]);
  const itemIndex = useMemo(() => new Map(items.data?.map((item) => [item.id, item]) ?? []), [items.data]);
  const locationIndex = useMemo(() => new Map(locations.data?.map((location) => [location.id, location]) ?? []), [locations.data]);
  const approvedSourceDocuments = useMemo(() => [...(salesDocuments.data ?? []), ...(purchaseDocuments.data ?? [])].filter((document) => document.status === "approved" && (document.kind === "sales_invoice" || document.kind === "purchase_order") && (!activeBranchId || document.branchId === Number(activeBranchId))), [salesDocuments.data, purchaseDocuments.data, activeBranchId]);

  const closeCreate = () => {
    setShowCreate(false); setLocationCode(""); setLocationName(""); setLocationType("warehouse"); setCapacity(""); setItemId(""); setDirection("transfer"); setMovementMode("transfer"); setFromLocationId(""); setToLocationId(""); setQuantity(""); setUnitCost(""); setReferenceType("سند تشغيلي"); setReferenceId(""); setDocumentId(""); setAdjustmentKind("increase"); setCountReference("");
  };
  const refresh = () => { void locations.refetch(); void movements.refetch(); void items.refetch(); void branches.refetch(); };
  const locationCreate = trpc.erp.inventory.locations.create.useMutation({
    onSuccess: () => { toast.success("تم إنشاء موقع المخزون وتسجيل أثر التدقيق."); closeCreate(); void locations.refetch(); },
    onError: (error) => toast.error(error.message),
  });
  const movementCreate = trpc.erp.inventory.movements.create.useMutation({
    onSuccess: () => { toast.success("تم تسجيل حركة المخزون كسجل تشغيلي مدقق."); closeCreate(); void movements.refetch(); },
    onError: (error) => toast.error(error.message),
  });
  const documentMovementCreate = trpc.erp.inventory.movements.fromApprovedDocument.useMutation({ onSuccess: (result) => { toast.success(`تم تسجيل ${result.movementCount} حركة من المستند المعتمد دون ترحيل مالي.`); closeCreate(); void movements.refetch(); }, onError: (error) => toast.error(error.message) });
  const stockCountCreate = trpc.erp.inventory.movements.stockCountAdjustment.useMutation({ onSuccess: () => { toast.success("تم تسجيل تسوية الجرد مع أثر تدقيق غير مالي."); closeCreate(); void movements.refetch(); }, onError: (error) => toast.error(error.message) });
  const isSaving = locationCreate.isPending || movementCreate.isPending || documentMovementCreate.isPending || stockCountCreate.isPending;
  const needsFrom = true;
  const needsTo = true;

  const submitLocation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeBranchId) return toast.error("اختر فرعًا تشغيليًا قبل إنشاء الموقع.");
    locationCreate.mutate({ branchId: Number(activeBranchId), locationCode, name: locationName, locationType, capacity: capacity ? Number(capacity) : undefined });
  };
  const submitMovement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeBranchId) return toast.error("اختر الفرع التشغيلي قبل متابعة الإجراء.");
    if (movementMode === "approved_document") { if (!documentId || !toLocationId) return toast.error("اختر مستندًا معتمدًا وموقع المخزون المرتبط به."); documentMovementCreate.mutate({ documentId: Number(documentId), locationId: Number(toLocationId), occurredAt: new Date() }); return; }
    if (movementMode === "stock_count") { if (!itemId || !toLocationId) return toast.error("اختر الصنف وموقع الجرد قبل تسجيل التسوية."); stockCountCreate.mutate({ branchId: Number(activeBranchId), itemId: Number(itemId), locationId: Number(toLocationId), adjustmentKind, quantity: Number(quantity), countReference, occurredAt: new Date() }); return; }
    if (!itemId || !fromLocationId || !toLocationId) return toast.error("اختر الصنف وموقعي المصدر والوجهة للتحويل.");
    movementCreate.mutate({ branchId: Number(activeBranchId), itemId: Number(itemId), direction, quantity: Number(quantity), fromLocationId: Number(fromLocationId), toLocationId: Number(toLocationId), unitCost: unitCost ? Number(unitCost) : undefined, referenceType, referenceId, occurredAt: new Date() });
  };

  const loading = branches.isLoading || locations.isLoading || movements.isLoading;
  const queryError = branches.error || locations.error || movements.error || items.error;
  const contentTitle = tab === "locations" ? "مواقع التخزين" : "سجل حركات المخزون";

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#1c4563] bg-[#092238] shadow-[0_18px_42px_rgba(0,0,0,0.15)]">
        <div className="flex flex-col gap-4 border-b border-[#193f5d] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div><div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#0c3b4a] text-[#58d9c5]"><Boxes className="h-4 w-4" /></div><h3 className="text-sm font-bold text-[#e6f2fc]">مركز رقابة المخزون</h3></div><p className="mt-1 text-[10px] text-[#7899af]">حركات مادية مدققة، مستقلة عن أي قيد أو ترحيل مالي.</p></div>
          <div className="flex flex-wrap items-center gap-2"><select aria-label="الفرع التشغيلي" value={branchId} onChange={(event) => { setBranchId(event.target.value); setFromLocationId(""); setToLocationId(""); setDocumentId(""); }} disabled={accessDenied || !isAuthenticated || !hasCompany} className="h-9 min-w-40 rounded-lg border border-[#24506e] bg-[#0a2941] px-3 text-xs text-[#dcecf8] outline-none focus:border-[#54b9f4]"><option value="">{branches.data?.length ? "الفرع الأول المتاح" : "لا توجد فروع"}</option>{branches.data?.map((branch) => <option value={branch.id} key={branch.id}>{branch.branchCode} — {branch.name}</option>)}</select><Button variant="outline" onClick={refresh} disabled={loading || !hasCompany} className="h-9 border-[#254c67] bg-[#0a2941] px-3 text-xs text-[#bdd8eb] hover:bg-[#11344e] hover:text-white"><RefreshCw className="ml-1 h-3.5 w-3.5" />تحديث</Button><Button onClick={() => { setShowCreate(true); setTab(tab); }} disabled={!isAuthenticated || accessDenied || !hasCompany || !activeBranchId} className="h-9 rounded-lg bg-[#1b887c] px-3 text-xs text-white hover:bg-[#157066]"><Plus className="ml-1 h-3.5 w-3.5" />{tab === "locations" ? "إضافة موقع" : "إجراء حركة"}</Button></div>
        </div>
        <div className="flex gap-1 border-b border-[#193f5d] px-5 sm:px-6"><button onClick={() => { setTab("locations"); setShowCreate(false); }} className={`border-b-2 px-3 py-3 text-xs font-bold transition-colors ${tab === "locations" ? "border-[#56d6c1] text-[#bffaf0]" : "border-transparent text-[#7999ae] hover:text-[#d2eaf8]"}`}><MapPin className="ml-1 inline h-3.5 w-3.5" />المواقع ({locations.data?.length ?? 0})</button><button onClick={() => { setTab("movements"); setShowCreate(false); }} className={`border-b-2 px-3 py-3 text-xs font-bold transition-colors ${tab === "movements" ? "border-[#56d6c1] text-[#bffaf0]" : "border-transparent text-[#7999ae] hover:text-[#d2eaf8]"}`}><ClipboardList className="ml-1 inline h-3.5 w-3.5" />الحركات ({movements.data?.length ?? 0})</button></div>
        {showCreate && tab === "locations" ? <form onSubmit={submitLocation} className="border-b border-[#193f5d] bg-[#071d30] px-5 py-5 sm:px-6"><div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#c6f5ef]"><PackagePlus className="h-4 w-4 text-[#57d8c4]" />تعريف موقع تخزين جديد</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="رمز الموقع"><input value={locationCode} onChange={(event) => setLocationCode(event.target.value.toUpperCase())} required pattern="[A-Za-z0-9_-]{2,48}" placeholder="WH-RYD-01" className={inputClass} /></Field><Field label="اسم الموقع"><input value={locationName} onChange={(event) => setLocationName(event.target.value)} required minLength={2} placeholder="مستودع الرياض الرئيسي" className={inputClass} /></Field><Field label="نوع الموقع"><select value={locationType} onChange={(event) => setLocationType(event.target.value as keyof typeof locationTypeLabels)} className={inputClass}>{Object.entries(locationTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="السعة (اختياري)"><input type="number" min="0.001" step="0.001" value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="0.000" className={inputClass} /></Field></div><FormFooter onCancel={closeCreate} isSaving={isSaving} saveLabel="حفظ الموقع" /></form> : null}
        {showCreate && tab === "movements" ? <form onSubmit={submitMovement} className="border-b border-[#193f5d] bg-[#071d30] px-5 py-5 sm:px-6"><div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#c6f5ef]"><ClipboardList className="h-4 w-4 text-[#57d8c4]" />إجراء حركة مخزون محكومة</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="مسار التسجيل"><select value={movementMode} onChange={(event) => { setMovementMode(event.target.value as MovementMode); setFromLocationId(""); setToLocationId(""); setDocumentId(""); }} className={inputClass}><option value="transfer">تحويل بين موقعين</option><option value="approved_document">من مستند معتمد</option><option value="stock_count">تسوية جرد</option></select></Field>{movementMode === "approved_document" ? <><Field label="المستند المعتمد"><select value={documentId} onChange={(event) => setDocumentId(event.target.value)} required className={inputClass}><option value="">اختر فاتورة مبيعات أو أمر شراء معتمد</option>{approvedSourceDocuments.map((document) => <option key={document.id} value={document.id}>{document.documentNumber} — {document.kind === "sales_invoice" ? "إخراج مبيعات" : "إدخال مشتريات"}</option>)}</select></Field><Field label="موقع المخزون"><select value={toLocationId} onChange={(event) => setToLocationId(event.target.value)} required className={inputClass}><option value="">اختر الموقع المرتبط</option>{selectedLocations.map((location) => <option key={location.id} value={location.id}>{location.locationCode} — {location.name}</option>)}</select></Field></> : null}{movementMode === "stock_count" ? <><Field label="الصنف"><select value={itemId} onChange={(event) => setItemId(event.target.value)} required className={inputClass}><option value="">اختر الصنف</option>{items.data?.filter((item) => item.itemType !== "service").map((item) => <option key={item.id} value={item.id}>{item.itemCode} — {item.name}</option>)}</select></Field><Field label="نتيجة الجرد"><select value={adjustmentKind} onChange={(event) => setAdjustmentKind(event.target.value as "increase" | "decrease")} className={inputClass}><option value="increase">زيادة فعلية</option><option value="decrease">نقص فعلي</option></select></Field><Field label="فرق الكمية"><input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required className={inputClass} /></Field><Field label="موقع الجرد"><select value={toLocationId} onChange={(event) => setToLocationId(event.target.value)} required className={inputClass}><option value="">اختر موقع الجرد</option>{selectedLocations.map((location) => <option key={location.id} value={location.id}>{location.locationCode} — {location.name}</option>)}</select></Field><Field label="مرجع محضر الجرد"><input value={countReference} onChange={(event) => setCountReference(event.target.value.toUpperCase())} required minLength={3} maxLength={96} placeholder="COUNT-2026-001" className={inputClass} /></Field></> : null}{movementMode === "transfer" ? <><Field label="الصنف"><select value={itemId} onChange={(event) => setItemId(event.target.value)} required className={inputClass}><option value="">اختر الصنف</option>{items.data?.filter((item) => item.itemType !== "service").map((item) => <option key={item.id} value={item.id}>{item.itemCode} — {item.name}</option>)}</select></Field><Field label="الكمية"><input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required className={inputClass} /></Field><Field label="الموقع المصدر"><select value={fromLocationId} onChange={(event) => setFromLocationId(event.target.value)} required className={inputClass}><option value="">اختر المصدر</option>{selectedLocations.map((location) => <option key={location.id} value={location.id}>{location.locationCode} — {location.name}</option>)}</select></Field><Field label="الموقع الوجهة"><select value={toLocationId} onChange={(event) => setToLocationId(event.target.value)} required className={inputClass}><option value="">اختر الوجهة</option>{selectedLocations.filter((location) => String(location.id) !== fromLocationId).map((location) => <option key={location.id} value={location.id}>{location.locationCode} — {location.name}</option>)}</select></Field><Field label="نوع المرجع"><input value={referenceType} onChange={(event) => setReferenceType(event.target.value)} required minLength={2} maxLength={64} className={inputClass} /></Field><Field label="رقم المرجع"><input value={referenceId} onChange={(event) => setReferenceId(event.target.value)} required maxLength={96} placeholder="TRF-2026-001" className={inputClass} /></Field></> : null}</div><p className="mt-3 text-[10px] leading-5 text-[#83a3b8]">يقتصر التحويل على مواقع الشركة، ولا تُنشأ الحركة المصدرية إلا من مستند معتمد. جميع المسارات تسجل أثرًا ماديًا مدققًا فقط ولا تنشئ قيدًا أو رصيدًا ماليًا.</p><FormFooter onCancel={closeCreate} isSaving={isSaving} saveLabel={movementMode === "stock_count" ? "تسجيل تسوية الجرد" : movementMode === "approved_document" ? "إنشاء حركة المستند" : "تسجيل التحويل"} /></form> : null}
        <div className="min-h-[290px] px-5 py-5 sm:px-6">
          {loading ? <div className="flex h-52 items-center justify-center gap-2 text-sm text-[#9ab9cf]"><Loader2 className="h-4 w-4 animate-spin" />جارٍ تحميل {contentTitle}…</div> : null}
          {queryError ? <div className="flex h-52 items-center justify-center text-center text-sm text-[#ffaca0]">{queryError.message}</div> : null}
          {!loading && !queryError && tab === "locations" && selectedLocations.length === 0 ? <EmptyState icon={MapPin} title={setupRequired ? "يلزم تهيئة الشركة أولًا" : accessDenied ? "الوصول إلى المخزون مقيّد" : "لا توجد مواقع تخزين ضمن الفرع"} description={setupRequired ? "أنشئ الشركة والفرع التشغيلي من قسم الإدارة قبل تعريف أي موقع أو حركة مخزون." : accessDenied ? "لا يتم تحميل بيانات التشغيل قبل التحقق من نطاق الصلاحية." : "عرّف مستودعًا أو خزانًا أو ناقلة قبل تسجيل حركة مادية."} /> : null}
          {!loading && !queryError && tab === "movements" && selectedMovements.length === 0 ? <EmptyState icon={ClipboardList} title={setupRequired ? "يلزم تهيئة الشركة أولًا" : accessDenied ? "الوصول إلى المخزون مقيّد" : "لا توجد حركات مسجلة ضمن الفرع"} description={setupRequired ? "أنشئ الشركة والفرع التشغيلي من قسم الإدارة قبل تعريف أي موقع أو حركة مخزون." : accessDenied ? "لا يتم تحميل بيانات التشغيل قبل التحقق من نطاق الصلاحية." : "اختر موقعًا وصنفًا مرجعيًا، ثم سجّل الإدخال أو الإخراج أو التحويل."} /> : null}
          {!loading && !queryError && tab === "locations" && selectedLocations.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-right"><thead><tr className="border-b border-[#193f5d] text-[11px] text-[#82a4b9]"><th className="pb-3 font-semibold">الموقع</th><th className="pb-3 font-semibold">النوع</th><th className="pb-3 font-semibold">الفرع</th><th className="pb-3 font-semibold">السعة</th><th className="pb-3 font-semibold">الحالة</th></tr></thead><tbody>{selectedLocations.map((location) => <tr key={location.id} className="border-b border-[#123650] text-sm text-[#c4dcec]"><td className="py-3"><div className="font-semibold text-[#dcecf8]">{location.name}</div><div className="mt-0.5 font-mono text-[10px] text-[#7fa1b7]">{location.locationCode}</div></td><td className="py-3">{locationTypeLabels[location.locationType]}</td><td className="py-3 text-xs">{branches.data?.find((branch) => branch.id === location.branchId)?.name ?? `#${location.branchId}`}</td><td className="py-3 font-mono text-xs">{location.capacity ? formatQuantity(location.capacity) : "—"}</td><td className="py-3"><span className="rounded-md bg-[#124535] px-2 py-1 text-[10px] font-bold text-[#74e3b4]">نشط</span></td></tr>)}</tbody></table></div> : null}
          {!loading && !queryError && tab === "movements" && selectedMovements.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-right"><thead><tr className="border-b border-[#193f5d] text-[11px] text-[#82a4b9]"><th className="pb-3 font-semibold">الحركة</th><th className="pb-3 font-semibold">الصنف</th><th className="pb-3 font-semibold">المسار</th><th className="pb-3 font-semibold">الكمية</th><th className="pb-3 font-semibold">المرجع</th><th className="pb-3 font-semibold">التاريخ</th></tr></thead><tbody>{selectedMovements.map((movement) => { const meta = directionMeta[movement.direction]; const MovementIcon = meta.icon; return <tr key={movement.id} className="border-b border-[#123650] text-sm text-[#c4dcec]"><td className="py-3"><span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${meta.tone}`}><MovementIcon className="h-3 w-3" />{meta.label}</span></td><td className="py-3"><div className="font-semibold">{itemIndex.get(movement.itemId)?.name ?? `صنف #${movement.itemId}`}</div><div className="font-mono text-[10px] text-[#7fa1b7]">{itemIndex.get(movement.itemId)?.itemCode ?? "—"}</div></td><td className="py-3 text-xs text-[#a7c5da]">{movement.fromLocationId ? locationIndex.get(movement.fromLocationId)?.locationCode ?? `#${movement.fromLocationId}` : "خارجي"} <ArrowLeftRight className="mx-1 inline h-3 w-3 text-[#6096af]" /> {movement.toLocationId ? locationIndex.get(movement.toLocationId)?.locationCode ?? `#${movement.toLocationId}` : "خارجي"}</td><td className="py-3 font-mono text-xs font-bold text-[#d9f3ee]">{formatQuantity(movement.quantity)}</td><td className="py-3"><div className="text-xs">{movement.referenceType}</div><div className="font-mono text-[10px] text-[#7fa1b7]">{movement.referenceId}</div></td><td className="py-3 text-xs text-[#a7c5da]">{new Date(movement.occurredAt).toLocaleDateString("ar-SA")}</td></tr>; })}</tbody></table></div> : null}
        </div>
      </section>
    </div>
  );
}

const inputClass = "h-10 w-full rounded-lg border border-[#24506e] bg-[#0a2941] px-3 text-sm text-[#e6f4ff] outline-none placeholder:text-[#57768d] focus:border-[#54b9f4]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1"><span className="text-[11px] font-bold text-[#a7c5da]">{label}</span>{children}</label>;
}

function FormFooter({ onCancel, isSaving, saveLabel }: { onCancel: () => void; isSaving: boolean; saveLabel: string }) {
  return <div className="mt-4 flex items-center justify-between gap-3"><p className="text-[10px] text-[#7998ac]">يُسجل هذا الإجراء تلقائيًا ضمن أثر تدقيق غير قابل للتعديل.</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={onCancel} disabled={isSaving} className="h-9 border-[#254c67] bg-[#0a2941] text-xs text-[#bdd8eb] hover:bg-[#11344e] hover:text-white">إلغاء</Button><Button type="submit" disabled={isSaving} className="h-9 bg-[#1b887c] text-xs text-white hover:bg-[#157066]">{isSaving ? <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> : null}{saveLabel}</Button></div></div>;
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Building2; title: string; description: string }) {
  return <div className="flex h-[210px] flex-col items-center justify-center text-center"><div className="grid h-11 w-11 place-items-center rounded-xl border border-[#24506e] bg-[#0a2941] text-[#61d9c5]"><Icon className="h-5 w-5" /></div><h4 className="mt-3 text-sm font-bold text-[#dcecf8]">{title}</h4><p className="mt-1 max-w-md text-xs leading-6 text-[#7d9caf]">{description}</p></div>;
}

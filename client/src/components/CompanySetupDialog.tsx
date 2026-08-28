import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Building2, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

type CompanySetupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export default function CompanySetupDialog({ open, onOpenChange, onCompleted }: CompanySetupDialogProps) {
  const { isAuthenticated } = useAuth();
  const [legalName, setLegalName] = useState("");
  const [companyCode, setCompanyCode] = useState("GRAY-01");
  const [baseCurrency, setBaseCurrency] = useState("SAR");
  const [timeZone, setTimeZone] = useState("Asia/Riyadh");
  const createCompany = trpc.erp.setup.createInitialCompany.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الشركة وتسجيل حدث التدقيق.");
      onOpenChange(false);
      onCompleted?.();
    },
    onError: (error) => toast.error(error.message || "تعذر إتمام تهيئة الشركة."),
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createCompany.mutate({ legalName, companyCode, baseCurrency, timeZone });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-xl rounded-2xl border-[#dbe4dd] bg-[#fbfcfa] p-0 text-right shadow-[0_28px_80px_rgba(15,48,38,0.22)]" showCloseButton={!createCompany.isPending}>
        <div className="border-b border-[#e6ece7] bg-[#eef6f1] px-6 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#173b30] text-[#bde9d3]"><Building2 className="h-5 w-5" /></div>
            <DialogHeader className="gap-1 text-right sm:text-right">
              <DialogTitle className="text-right text-lg text-[#183128]">تهيئة الشركة</DialogTitle>
              <DialogDescription className="text-right leading-6 text-[#63736b]">ينشئ هذا الإجراء الكيان القانوني ونطاق مدير النظام فقط، ويضيف حدث تدقيق. لا ينشئ فواتير أو قيودًا أو أرصدة.</DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {isAuthenticated ? (
          <form onSubmit={submit} className="space-y-4 px-6 py-5">
            <label className="block space-y-1.5"><span className="text-xs font-bold text-[#334a40]">الاسم القانوني للشركة</span><input value={legalName} onChange={(e) => setLegalName(e.target.value)} required minLength={3} placeholder="مثال: شركة جراي للتجارة" className="h-11 w-full rounded-xl border border-[#d9e2dc] bg-white px-3 text-sm text-[#20362c] outline-none transition placeholder:text-[#a1aea7] focus:border-[#55967b] focus:ring-4 focus:ring-[#7fc7a8]/15" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5"><span className="text-xs font-bold text-[#334a40]">رمز الشركة</span><input value={companyCode} onChange={(e) => setCompanyCode(e.target.value.toUpperCase())} required pattern="[A-Za-z0-9_-]{2,32}" className="h-11 w-full rounded-xl border border-[#d9e2dc] bg-white px-3 text-sm text-[#20362c] outline-none transition focus:border-[#55967b] focus:ring-4 focus:ring-[#7fc7a8]/15" /></label>
              <label className="block space-y-1.5"><span className="text-xs font-bold text-[#334a40]">العملة الأساسية</span><input value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())} required minLength={3} maxLength={3} className="h-11 w-full rounded-xl border border-[#d9e2dc] bg-white px-3 text-sm text-[#20362c] outline-none transition focus:border-[#55967b] focus:ring-4 focus:ring-[#7fc7a8]/15" /></label>
            </div>
            <label className="block space-y-1.5"><span className="text-xs font-bold text-[#334a40]">المنطقة الزمنية</span><input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} required className="h-11 w-full rounded-xl border border-[#d9e2dc] bg-white px-3 text-sm text-[#20362c] outline-none transition focus:border-[#55967b] focus:ring-4 focus:ring-[#7fc7a8]/15" /></label>
            <div className="flex items-start gap-2 rounded-xl border border-[#d8e8df] bg-[#f4faf6] p-3 text-xs leading-5 text-[#547367]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#398062]" />يُسند نطاق الشركة إلى حسابك الحالي. يتطلب تعيين أدوار إضافية وإنشاء فروع موافقة إدارية لاحقة.</div>
            <DialogFooter className="gap-2 border-t border-[#edf1ee] pt-4 sm:justify-start">
              <Button type="submit" disabled={createCompany.isPending} className="h-10 rounded-xl bg-[#173b30] px-4 text-white hover:bg-[#102d24]">
                {createCompany.isPending ? <Loader2 className="ml-1.5 h-4 w-4 animate-spin" /> : <Building2 className="ml-1.5 h-4 w-4" />}إنشاء الشركة
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createCompany.isPending} className="h-10 rounded-xl border-[#d8e2dc] bg-white text-[#4f6259] hover:bg-[#f3f7f4]">إلغاء</Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 px-6 py-6"><p className="text-sm leading-6 text-[#617169]">تتطلب تهيئة الشركة جلسة مصادق عليها لضمان ربط الإجراء بسجل تدقيق موثوق.</p><Button onClick={() => startLogin()} className="h-10 rounded-xl bg-[#173b30] text-white hover:bg-[#102d24]">تسجيل الدخول للمتابعة</Button></div>
        )}
      </DialogContent>
    </Dialog>
  );
}

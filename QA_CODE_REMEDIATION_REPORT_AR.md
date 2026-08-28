# GRAY ERP — تقرير الإصلاح البرمجي V2

## الحالة

- نطاق العمل: مراجعة وإصلاح محلي فقط على نسخة عمل منفصلة.
- Production: لم يُلمس.
- QA: لم تُنشأ ولم يُجرَ اتصال خارجي.
- Database/Storage/Auth/Secrets: لم تُنفذ عليها عمليات خارجية.
- Financial Posting / GL / AR / AP / Payments / Closing / Migration: بقيت محجوبة.

## الإصلاحات المنفذة

### C-001 — CSRF / Same-Origin
- Session Cookie أصبح `SameSite=Lax`.
- جميع tRPC mutations تمر عبر حارس مصدر.
- يجب وجود `Origin` أو `Referer`؛ غيابهما يُرفض.
- إذا وُجدا معًا يجب أن يتطابقا.
- تتم مقارنة المصدر مع `APP_ORIGIN` إذا كان مضبوطًا.
- في Production، غياب `APP_ORIGIN` يسبب رفضًا مغلقًا (fail-closed).
- في Development فقط يمكن استخدام أصل الطلب كـfallback.
- أضيفت اختبارات للمصدر المطابق، المصدر الخارجي، المصدر غير الصالح، غياب المصدر، تعارض Origin/Referer، وReferer المطابق.

### C-002 — itemId Company Scope
- كل `itemId` في بنود المستند التجاري يتحقق من وجوده، وملكيته للشركة، وكونه فعالًا قبل الحفظ.

### C-003 — Governance Documentation
- تم التفريق صراحة بين طبقة الجاهزية التنفيذية الحالية PRE-01..PRE-06 وبين متطلبات الحوكمة الأوسع PRE-07..PRE-08 وC.1.
- لم يتم إسقاط PRE-07 أو PRE-08 من الحوكمة لمجرد أن `financialReadiness()` الحالية تعرض ستة عناصر تنفيذية.

### C-004 — Test Count Documentation
- العد الساكن الحالي: **53 اختبارًا عبر 10 ملفات اختبار**.
- لم تُدّعَ نتيجة تشغيل جديدة لـTypeScript/Vitest لهذه النسخة.

### C-005 — Documentation Reference
- تم تصحيح الإحالة إلى `reference-alignment-boundary.md`.
- تم حذف الادعاء القديم غير المتوافق مع المصدر الحالي بخصوص `createBranchForUser`.

## ما لم يُعتمد بعد

- `pnpm check`: غير مُثبت على V2.
- `pnpm test`: غير مُثبت على V2.
- Live QA: محجوب.
- Production Isolation Proof: غير مُثبت.
- Audit path unification: لم يُنفذ ضمن V2 لتجنب توسيع نطاق التغيير دون اختبار transaction-aware.

## شرط التشغيل قبل أي نشر

يجب ضبط `APP_ORIGIN` في بيئة التشغيل الإنتاجية على أصل التطبيق المعتمد، مثل نطاق GRAY ERP الرسمي عند اعتماده، دون وضع أسرار في الكود أو المستند.

## الحكم

**CODE PATCH V2 = READY FOR RUNTIME VERIFICATION ONLY**

ولا يعني ذلك GO للنشر أو Production أو Live QA.

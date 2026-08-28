# GRAY ERP V2 — تقرير المراجعة والإصلاح المحلي

## النطاق

مراجعة محلية للنسخة `gray-erp-v2.zip` دون أي اتصال خارجي أو Production/QA/Database/Storage/Auth/Secrets.

## نتيجة المراجعة

- تم فك الحزمة وفحص بنيتها.
- العدد الساكن: 10 ملفات اختبار / 53 حالة `it()`.
- تم التحقق من وجود إصلاح CSRF في `server/_core/trpc.ts` ومن ضبط Session Cookie إلى `SameSite=Lax`.
- تم التحقق من تحقق `itemId` داخل نطاق الشركة وحالة النشاط قبل حفظ بنود المستندات التجارية.
- تم التحقق من بقاء `financialReadiness()` بحالة `blocked` و`ready:false`.
- تم التحقق من بقاء `postJournalEntry` و`issueFinancialStatement` خلف الحاجز المالي في الخادم.

## إصلاح إضافي منفذ

تم اكتشاف أن تفعيل حارس CSRF على جميع mutations يتطلب أن تزود اختبارات `createCaller` برؤوس مصدر صالحة. بعض fixtures القديمة كانت تستخدم `headers: {}`، مما يجعل الاختبار يفشل عند حارس المصدر قبل الوصول إلى الإجراء الذي يريد الاختبار التحقق منه.

تم تحديث fixtures في:

- `server/auth.logout.test.ts`
- `server/masterData.authorization.test.ts`
- `server/companySetup.status.test.ts`
- `server/financial-guards.integration.test.ts`

إلى مصدر اختبار محلي معقم:

`https://erp.example.test`

ولا يتضمن ذلك أي سر أو اتصالًا خارجيًا.

## الاختبارات التشغيلية

تعذر تشغيل `pnpm check` و`pnpm test` و`pnpm build` في بيئة المراجعة الحالية لأن `node_modules` غير موجودة و`pnpm@10.4.1` لم يمكن تنزيله بسبب عدم توفر اتصال الشبكة إلى npm registry. كما أن `tsc` المتاح عالميًا توقف بسبب غياب تعريفات المشروع (`node` و`vite/client`).

لذلك لا يُسجل أي `PASS` تشغيلي للاختبارات أو البناء.

## الحكم

**CODE REVIEW = CONDITIONAL / RUNTIME VERIFICATION REQUIRED**

النسخة لا تُعلن جاهزة للنشر أو Production أو Live QA بناءً على هذه المراجعة وحدها. يلزم تشغيل `pnpm check`, `pnpm test`, و`pnpm build` في بيئة تحتوي dependencies كاملة قبل اعتماد النتيجة التشغيلية.

القفل المالي والحوكمي لم يتغير.

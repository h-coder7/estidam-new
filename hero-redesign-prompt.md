# Estidam — Hero Section Redesign (adapted prompt)

> مأخوذ من برومبت Kelder — **جزء الهيرو فقط** — ومعدّل ليتوافق مع مشروع Estidam:
> Next.js 16 (App Router) + next-intl (ar / en, RTL) + SCSS + Bootstrap + Lenis، خط Lama Sans، وألوان المشروع.
> ممنوع: Preloader، Tailwind، WebGL/three، أي نص أو رقم جديد غير موجود في المشروع.

## الهدف
إعادة تصميم `src/components/home/Hero` بحيث يكون الهيرو: هادي، دقيق، "بيانات حيّة" — نفس روح Kelder،
لكن بهوية Estidam (تشغيل شركات الحج + بيانات + ذكاء اصطناعي).

## الألوان (من `style.scss`)
- Ink / الأغمق: `--dark #0b1a33`
- الأزرق الأساسي: `--blue #295CC7`
- الأزرق الثانوي (الـ accent الوحيد): `--secondary #1691D0` — نسخة فاتحة منه `#6dd3ff` تُستخدم فقط
  للنقاط "الحية" (lens / ripple / end dot) على الخلفية الغامقة.
- تدرج الهيرو العمودي: `#050d1c → #0b1a33 → #173f8f → #295CC7 → #1691D0 → #a9d6f2 → #eaf4fb → #ffffff`
  (ينتهي أبيض ليندمج مع سكشن WhyEstidam).
- كارت الداشبورد: bloom فاتح أعلى البداية فوق `#2152b8 → #0f2c66`، زوايا 20px، بدون ظلال ثقيلة.

## الخط
Lama Sans فقط (`--font-heading` للعناوين). H1 كبير (clamp ~ 40→76px) بـ tracking سالب بسيط في EN فقط
(في AR بدون letter-spacing).

## المحتوى (نفس داتا المشروع — CMS أولاً ثم fallback من الترجمة)
- `getHeroContent(locale)` / `hero.*`: eyebrow, title, titleAccent, description, primaryCta/Url, secondaryCta/Url.
- الداشبورد: `getJourneyContent(locale)` / `hajjJourney.*` — المراحل الثلاث (Before / During / After the Season):
  label, title, points + `phaseNCardTitle`, `phaseNCardStatus`, `phaseNCardNote`.
- شريط التوزيع أسفل الشارت: `operations.input1..4` (Systems / Data / Operations / People).
- لا أرقام مخترعة: الشارت توضيحي بدون قيم على المحور.

## التخطيط
1. Navbar الافتراضي (الأبيض الشفاف) فوق الهيرو، ويتحول لشريط `--dark` ثابت عند السكرول (موجود بالفعل في Navbar).
2. المحتوى في المنتصف: pill زجاجي فيه أيقونة `fa-kaaba` + eyebrow → H1 (title سطر، titleAccent سطر بلون فاتح من الثانوي)
   → وصف (max 640px) → زرارين (Primary: `--secondary` + نص أبيض، Secondary: outline أبيض شفاف). على الموبايل الزرارين full-width.
3. تحتهم: كارت **Live Operations Desk** (الداشبورد):
   - يسار (في RTL يمين): رقم المرحلة + label، عنوان المرحلة كبير، pill الحالة (`cardStatus`)، 3 صفوف بخط متقطع من `points`.
   - يمين: عنوان الكارت (`cardTitle`) + سويتش 3 مراحل (pill أبيض بينزلق). شارت 240px: 4 خطوط grid
     (3 متقطعة + 1 صلب)، area + line، خط إرشادي متقطع عند ذروة المرحلة + نقطة بيضاء + tooltip بـ `cardNote`،
     ونقطة نهاية "حيّة" بلون الـ accent. أسفل الشارت labels المراحل الثلاث (النشطة بالأبيض).
   - شريط توزيع من 4 أجزاء مستديرة + legend (Systems / Data / Operations / People).
   - ≥1200: عمود 380px بجانب الشارت · ≤1199: العمود يبقى صف فوق الشارت · ≤575: كل حاجة stack.

## الحركة
- Entrance عند التحميل (بدون preloader): الـ pill يطلع 12px مع fade (0ms)، سطور الـ H1 تطلع من mask
  (60ms + 90ms لكل سطر)، الوصف fade عند 420ms، الأزرار عند 520ms، الكارت يطلع من 40px و scale .98 عند 600ms.
- **Halftone canvas** خلف المحتوى (يتولد برمجياً — بدون SVG خارجي): حقل نقاط بيضاء على شكل حلقة حول العنوان
  بأحجام وشفافية متدرجة:
  - shimmer قطري بطيء ±10% opacity؛
  - موجات نابضة من خلف العنوان (المركز عند 42% من ارتفاع الحقل)، 150u/s، مسافة 280، تتلاشى على 1100، مع echo؛
  - lens تحت الماوس (شاشات > 1024 و pointer: fine) نصف قطر 130: النقاط تكبر وتتباعد والأقرب تتلون بالـ accent؛
  - click/tap على خلفية الهيرو يطلق ripple (520u/s، عرض 36، 1.5s) بقمة accent؛
  - يشتغل فقط والهيرو ظاهر (IntersectionObserver) ومستقل عن fps (`1-(1-k)^(dt·60)`).
- Parallax: طبقة الـ halftone تتأخر 0.35 من scrollY، مع تشبّع ناعم (max ~120px).
- **Tilt**: الكارت يبدأ مايل للخلف `perspective(1000px) rotateX(20deg) scale(.9)` من أعلى المنتصف
  (7° / .94 على ≤575) والـ area خافتة .65 — عن طريق `@property --tilt-k` في CSS (يظهر من أول paint)،
  والسكربت يكتب `--tilt-k` بس: يتعدل مع السكرول (smoothstep) لحد ما منتصف الكارت يقابل منتصف الشاشة.
  لو الكارت كله ظاهر عند التحميل يتعدل لوحده بعد 700ms على 1400ms easeInOutCubic.
- الشارت (عند الظهور وعند تغيير المرحلة): الخط يترسم بـ clip-path wipe، الـ area fade عند 450ms، الـ guide يطلع عند 800،
  النقطة 900، الـ tooltip 960، نقطة النهاية 1000 ثم حلقة تتنفس كل 2.8s. أجزاء شريط التوزيع تكبر من البداية بفارق 80ms.
- `prefers-reduced-motion`: كل شيء ثابت في وضعه النهائي، بدون canvas حركة وبدون tilt.

## الملفات
- `Hero.tsx` (server) — يجمع الداتا ويرندر الهيكل.
- `HeroHalftone.tsx` (client) — الـ canvas + parallax.
- `HeroDashboard.tsx` (client) — السويتش، الشارت، الـ tilt.
- `_Hero.scss` — كل الستايل، RTL-safe (logical properties).
- `app/[locale]/page.tsx` — Navbar الافتراضي بدل `inner-nav` عشان يناسب الهيرو الغامق.
- `WaveGalaxy` يفضل في الفولدر بدون استخدام (ممكن يتمسح لاحقاً).

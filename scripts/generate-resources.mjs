import { readFile, mkdir } from 'node:fs/promises'
import ts from 'typescript'
import { chromium } from '@playwright/test'

const code = ts.transpileModule(await readFile(new URL('../src/data.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { resources, toFa } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
)
const font = (await readFile(new URL('../public/fonts/Vazirmatn.woff2', import.meta.url))).toString('base64')
const logo = (await readFile(new URL('../public/images/secretariat-logo.png', import.meta.url))).toString(
  'base64',
)
const specifics = {
  'lesson-study-starter': {
    quote: 'پرسش خوب، از چیزی شروع می‌شود که می‌خواهیم درباره یادگیری بهتر بفهمیم.',
    intro:
      'گروهی کوچک تشکیل دهید. به‌جای انتخاب یک عنوان کلی، یک دشواری یا فرصت واقعی را در یادگیری دانش‌آموزان مشخص کنید. قرار است شواهدی ببینید که در تصمیم بعدیِ تدریس به شما کمک کند.',
    actions: [
      'هر عضو، یک موقعیت واقعی از کلاس را بدون نام دانش‌آموزان روایت کند.',
      'یک پرسش انتخاب کنید؛ مثلاً «چه فعالیتی به توضیح استدلال در حل مسئله کمک می‌کند؟»',
      'نقش‌ها را روشن کنید: تسهیلگر، مجری درس، مشاهده‌گران و ثبت‌کننده گفت‌وگو.',
      'پیش از اجرا، پاسخ‌ها و دشواری‌های احتمالی دانش‌آموزان را پیش‌بینی کنید.',
    ],
    columns: ['مرحله درس', 'فعالیت و پرسش معلم', 'پاسخ احتمالی دانش‌آموز', 'شاهدی که ثبت می‌کنیم'],
    rows: ['شروع و برانگیختن پرسش', 'فعالیت فردی یا گروهی', 'اشتراک راهبردها', 'جمع‌بندی و ارزشیابی'],
  },
  'observation-guide': {
    quote: 'به‌جای «خوب یا بد بود»، بپرسیم: چه دیدیم و چه شنیدیم؟',
    intro:
      'پیش از ورود به کلاس، پرسش مشاهده و محل استقرار مشاهده‌گران را روشن کنید. تمرکز بر یادگیری چند دانش‌آموز یا یک فعالیت، اغلب به شواهد دقیق‌تری نسبت به ثبت همه‌چیز می‌انجامد.',
    actions: [
      'جمله توصیفی بنویسید: «سه بار از هم‌گروهی‌اش خواست روش حل را توضیح دهد.»',
      'قضاوت را جدا نگه دارید: «بی‌علاقه بود» یک تفسیر است، نه مشاهده.',
      'زمان، گفته‌های کلیدی و راهبردهای به‌کاررفته را ثبت کنید.',
      'برای ثبت تصویر یا صدا، رضایت و ضوابط حریم خصوصی مدرسه را رعایت کنید.',
    ],
    columns: ['زمان / موقعیت', 'آنچه دیدم یا شنیدم', 'تفسیر احتمالی من', 'پرسشی برای بررسی'],
    rows: ['شروع فعالیت', 'مواجهه با دشواری', 'گفت‌وگوی گروهی', 'تغییر در پاسخ یا راهبرد'],
  },
  'lesson-design-template': {
    quote: 'طرح درس، پیش‌بینیِ مسیر یادگیری است؛ نه فقط فهرستِ کارهای معلم.',
    intro:
      'هدف را با آنچه دانش‌آموز قرار است بفهمد یا بتواند توضیح دهد بنویسید. سپس فعالیتی انتخاب کنید که امکان مشاهده آن یادگیری را فراهم کند. این فرم، نقطه شروع گفت‌وگوی گروه است.',
    actions: [
      'هدف یادگیری را مشخص، محدود و قابل بررسی بنویسید.',
      'دانسته‌های پیشین و پاسخ‌های متفاوت دانش‌آموزان را پیش‌بینی کنید.',
      'برای هر فعالیت، یک شاهد یادگیری و یک پرسش پیگیری تعیین کنید.',
      'زمانی برای شنیدن راهبردهای مختلف و جمع‌بندی در نظر بگیرید.',
    ],
    columns: ['زمان و مرحله', 'فعالیت یادگیری', 'پاسخ / دشواری احتمالی', 'شاهد و پرسش پیگیری'],
    rows: ['ورود به مسئله', 'کاوش و تمرین', 'گفت‌وگو و توضیح', 'جمع‌بندی و خروج'],
  },
  'learning-conversation': {
    quote: 'گفت‌وگوی حرفه‌ای، جایی برای دفاع از خود نیست؛ جایی برای فهمیدنِ بیشتر است.',
    intro:
      'برای یک جلسه کوتاه، دستور جلسه و زمان مشخص کنید. از همه دعوت کنید شواهد خود را توصیف کنند. تسهیلگر مراقب باشد توجه گروه از یادگیری دانش‌آموزان به ارزیابی افراد تغییر نکند.',
    actions: [
      'توافق کنید: شنیدن بدون قطع‌کردن، پرسیدن پیش از نتیجه‌گیری و رعایت محرمانگی.',
      'پنج دقیقه برای بازخوانی پرسش و هدف جلسه کنار بگذارید.',
      'هر عضو ابتدا شواهد و سپس تفسیر خود را بیان کند.',
      'جلسه را با یک تصمیم کوچک، مسئول مشخص و زمان بازبینی تمام کنید.',
    ],
    columns: ['بخش جلسه', 'شاهد یا پرسش مطرح‌شده', 'برداشت‌های متفاوت', 'تصمیم / پیگیری'],
    rows: ['مرور هدف و توافق‌ها', 'اشتراک شواهد', 'بررسی تبیین‌ها', 'تعیین قدم بعدی'],
  },
  'lesson-analysis': {
    quote: 'یک رخداد کوچک در کلاس، می‌تواند پرسشی بزرگ برای یادگیری ما باشد.',
    intro:
      'یک موقعیت مشخص را انتخاب کنید؛ نه کل جلسه درس را. ترتیب رویدادها، گفته‌های کلیدی و نمونه کارِ مجاز را بازسازی کنید. سپس چند تبیین ممکن را کنار هم بگذارید و ببینید هرکدام به چه شاهدی نیاز دارد.',
    actions: [
      'موقعیت را بدون نام، برچسب و قضاوت توصیف کنید.',
      'فعالیت دانش‌آموز، تعامل‌ها و ابزارهای در دسترس را مشخص کنید.',
      'دست‌کم دو تفسیر ممکن بنویسید؛ یکی را زود قطعی نکنید.',
      'برای یک تغییر پیشنهادی، شاهد موفقیت و زمان بررسی تعیین کنید.',
    ],
    columns: ['رخداد / گفته', 'شاهد موجود', 'تبیین‌های ممکن', 'شاهد یا اقدام بعدی'],
    rows: ['پیش از رخداد', 'لحظه اصلی', 'واکنش هم‌کلاسی‌ها', 'ادامه یادگیری'],
  },
  'reflection-journal': {
    quote: 'قرار نیست هر روز همه‌چیز را تغییر دهیم؛ یک قدم روشن کافی است.',
    intro:
      'پس از کلاس، پنج دقیقه برای یک رخداد معنادار بنویسید. هدف، قضاوت درباره خوب یا بد بودن تدریس نیست؛ هدف این است که رابطه تصمیم‌های شما و تجربه یادگیری دانش‌آموزان روشن‌تر شود.',
    actions: [
      'یک لحظه مشخص را انتخاب کنید؛ چه اتفاقی افتاد؟',
      'احساس خود را جدا از آنچه دیده یا شنیده‌اید بنویسید.',
      'از خود بپرسید: کدام شواهد، برداشت من را تأیید یا به چالش می‌کشد؟',
      'فقط یک تغییر کوچک برای کلاس بعد انتخاب و نتیجه‌اش را پیگیری کنید.',
    ],
    columns: ['رخداد', 'مشاهده من', 'برداشت و پرسش من', 'تغییر کوچکِ بعدی'],
    rows: ['یک لحظه موفق', 'یک دشواری', 'یک پرسش دانش‌آموز', 'یک تصمیم برای فردا'],
  },
}
const css = `@font-face{font-family:V;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:V,sans-serif;direction:rtl;color:#354e47;-webkit-print-color-adjust:exact;print-color-adjust:exact} @page{size:A4;margin:0}.page{width:210mm;height:297mm;position:relative;padding:19mm 20mm 22mm;page-break-after:always;overflow:hidden;background:#fdfcf8}.page:last-child{page-break-after:auto}.header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #dce3d3;padding-bottom:12px;margin-bottom:26px}.header img{width:62px;height:48px;object-fit:contain}.header strong{font-size:11px;font-weight:600}.header span{font-size:9px;color:#94a280}.eyebrow{color:#a5845b;font-size:10px;margin-bottom:10px}h1{font-size:28px;line-height:1.8;font-weight:650;margin:0 0 12px;letter-spacing:-.6px}h2{font-size:20px;line-height:1.8;margin:23px 0 12px;font-weight:550}h3{font-size:13px;font-weight:550;margin:18px 0 10px}p{font-size:12px;line-height:2.25;margin:10px 0;color:#7d8d70}blockquote{font-size:17px;line-height:2;padding:20px 23px;margin:24px 0;background:#eaf0e0;border-right:3px solid #8ba170;color:#688454}ul,ol{padding-right:21px;margin:12px 0}li{font-size:11px;line-height:2.3;color:#7e916f;margin:7px 0}.note{padding:14px 17px;background:#f1eee1;border-radius:4px;font-size:10px;line-height:2.1;color:#a39777;margin-top:22px}.footer{position:absolute;bottom:14mm;left:20mm;right:20mm;display:flex;justify-content:space-between;font-size:8px;color:#b0ba9e;border-top:1px solid #dce4d1;padding-top:10px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:17px 28px;margin:28px 0}.meta>div{font-size:10px;color:#94a57f;border-bottom:1px solid #d9e3cb;height:35px}.prompt{padding:13px 0 18px;border-bottom:1px solid #dde5d2;margin-top:5px}.prompt strong{font-size:11px;font-weight:500;color:#82996d}.line{height:30px;border-bottom:1px dotted #d0ddc0;margin-top:6px}table{border-collapse:collapse;width:100%;table-layout:fixed;margin-top:22px}th{background:#eaf0e1;padding:13px 8px;font-size:10px;font-weight:500;border:1px solid #d8e2cc}td{font-size:10px;color:#91a37b;border:1px solid #d8e2cc;padding:15px 8px;height:104px;vertical-align:top}.privacy{margin-top:28px;padding:17px 20px;background:#edf2e5}.privacy h3{margin-top:0}.privacy p{font-size:10px;margin:0}.checklist{list-style:none;padding:0}.checklist li::before{content:'□';display:inline-block;font-size:16px;margin-left:9px;color:#8da672}.caption{font-size:9px;color:#a7b495;margin-top:15px}`
const browser = await chromium.launch({ headless: true })
await mkdir(new URL('../public/resources/', import.meta.url), { recursive: true })
for (const resource of resources) {
  const d = specifics[resource.id]
  const header = `<header class="header"><div><strong>دبیرخانه درس‌پژوهی و درس‌کاوی</strong><br><span>دفترچه همراه معلم · با هم، برای یادگیری</span></div><img src="data:image/png;base64,${logo}" alt="نشان دبیرخانه"></header>`
  const foot = (n) =>
    `<footer class="footer"><span>نمونه آموزشیِ تألیفی · جایگزین شیوه‌نامه رسمی نیست.</span><span>${toFa(n)} از ۳</span></footer>`
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>${resource.title}</title><style>${css}</style></head><body>
  <section class="page">${header}<div class="eyebrow">${resource.category} / راهنمای کاربردی</div><h1>${resource.title}</h1><p>${resource.description}</p><blockquote>${d.quote}</blockquote><h2>پیش از شروع</h2><p>${d.intro}</p><h3>چهار پیشنهاد برای عمل</h3><ol>${d.actions.map((a) => `<li>${a}</li>`).join('')}</ol><div class="note">این راهنما برای تمرین و گفت‌وگوی گروهی طراحی شده است. آن را با موضوع درس، پایه تحصیلی، امکانات مدرسه و نیازهای واقعی گروه خود سازگار کنید.</div>${foot(1)}</section>
  <section class="page">${header}<div class="eyebrow">از خواندن، به امتحان‌کردن</div><h1>تمرین و برگه کار</h1><p>پیش از اجرا، خانه‌های مرتبط را با هم تکمیل کنید. هنگام مشاهده، توصیف شواهد را از تفسیر خود جدا نگه دارید.</p><div class="meta"><div>نام گروه / تسهیلگر:</div><div>تاریخ / نوبت اجرا:</div><div>موضوع درس / پایه:</div><div>مدت فعالیت / کلاس:</div></div><div class="prompt"><strong>پرسش مشترک یا هدف یادگیریِ ما چیست؟</strong><div class="line"></div><div class="line"></div></div><table><thead><tr>${d.columns.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${d.rows.map((r) => `<tr><td>${r}</td><td></td><td></td><td></td></tr>`).join('')}</tbody></table><p class="caption">برای ثبت رخدادهای بیشتر، از این صفحه یک نسخه دیگر چاپ کنید.</p>${foot(2)}</section>
  <section class="page">${header}<div class="eyebrow">یادگیری، با بازاندیشی ادامه پیدا می‌کند.</div><h1>یک قدم روشن برای بعد</h1><p>با تکیه بر شواهد گفت‌وگو کنید. لازم نیست همه برداشت‌ها یکسان باشد؛ اختلاف نگاه می‌تواند پرسش‌های تازه‌ای پیش روی گروه بگذارد.</p><div class="prompt"><strong>۱. چه دیدیم و چه شنیدیم که به پرسش ما مربوط بود؟</strong><div class="line"></div><div class="line"></div></div><div class="prompt"><strong>۲. کدام برداشت ما تغییر کرد؟ چه چیزهایی هنوز روشن نیست؟</strong><div class="line"></div><div class="line"></div></div><div class="prompt"><strong>۳. در اجرای بعد، چه تغییر کوچکی را امتحان می‌کنیم؟</strong><div class="line"></div><div class="line"></div></div><h3>پیش از پایانِ نشست، بررسی کنیم:</h3><ul class="checklist"><li>پیشنهاد ما به یک شاهد مشخص از یادگیری تکیه دارد.</li><li>یک مسئول و یک زمان برای پیگیری تعیین کرده‌ایم.</li><li>می‌دانیم برای بررسی اثرِ تغییر، چه چیزی را مشاهده خواهیم کرد.</li><li>اطلاعات شناسایی دانش‌آموزان را از نسخه قابل اشتراک حذف کرده‌ایم.</li></ul><div class="privacy"><h3>یک یادآوری درباره حریم خصوصی</h3><p>نام، تصویر، صدا و اطلاعات شخصی دانش‌آموزان را بدون مجوز و رضایت معتبر ثبت یا منتشر نکنید. در روایت‌های آموزشی از نام مستعار و توصیف غیرقابل شناسایی استفاده کنید.</p></div>${foot(3)}</section>
  </body></html>`
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.pdf({
    path: new URL(`../public/resources/${resource.id}.pdf`, import.meta.url).pathname,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  })
  await page.close()
  console.log(`Created ${resource.id}.pdf`)
}
await browser.close()

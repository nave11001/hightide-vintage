import React from 'react';
import { ArrowRight } from 'lucide-react';
import { navigate, type LegalPage as PageId } from '../router';

// The shop's three documents.
//
// Written from what the code actually does rather than from a template: the
// data listed here is the data src/analytics.ts sends, netlify/functions/
// reserve.mjs stores and src/data.ts caches, and if any of that changes this
// has to change with it. A policy that describes a different site is worse
// than no policy, because it is a statement rather than an omission.
//
// NOT LEGAL ADVICE, and not a substitute for a lawyer reading it. What it is:
// an accurate description of the system, which is the part a lawyer cannot
// write without the source in front of them.
//
// Two things are deliberately left as ⟦…⟧ rather than guessed. They are facts
// about the business that only its owner knows, and a legal document that
// invents them is worth less than one with a hole in it.

const SHOP = 'HIGHTIDE VINTAGE';
const EMAIL = 'hightide1620@gmail.com';
const PHONE = '052-8879922';
const ADDRESS = 'הגבעה 28, כפר האורנים';
const UPDATED = 'אוגוסט 2026';

/** A run of prose, a list, or a sub-heading. */
type Block =
  | { h: string }
  | { p: string }
  | { ul: string[] }
  | { note: string };

interface Doc {
  title: string;
  lead: string;
  blocks: Block[];
}

const PRIVACY: Doc = {
  title: 'מדיניות פרטיות',
  lead: `${SHOP} מכבדת את פרטיות המשתמשים באתר. מסמך זה מסביר איזה מידע נאסף, לשם מה, עם מי הוא משותף, ומהן הזכויות שלכם לגביו.`,
  blocks: [
    { h: 'איזה מידע נאסף' },
    {
      p: 'האתר עצמו אינו כולל טופס הרשמה, חשבון משתמש או תהליך תשלום. לא נאספים בו שם, כתובת או פרטי אמצעי תשלום.',
    },
    { p: 'המידע שכן נאסף:' },
    {
      ul: [
        'מידע על שימוש באתר — אילו עמודים ופריטים נצפו, לחיצות על כפתורי רכישה, סוג המכשיר והדפדפן, ומקור ההגעה לאתר.',
        'מידע שנשמר בדפדפן שלכם בלבד — רשימת המועדפים ועותק של הקטלוג לטעינה מהירה. מידע זה אינו נשלח לשרתינו וניתן למחיקה בכל רגע דרך הגדרות הדפדפן.',
        'פניות ישירות — כאשר אתם פונים אלינו בווטסאפ, במייל או בטלפון, אנו מקבלים את פרטי ההתקשרות שמסרתם ואת תוכן הפנייה.',
      ],
    },
    { h: 'פניות דרך אינסטגרם ושמירת מספר טלפון' },
    {
      p: 'לצד האתר פועל שירות מענה אוטומטי בהודעות אינסטגרם. מי שבוחר לשריין פריט דרכו מתבקש למסור מספר טלפון. מסירת המספר היא בחירה של הפונה, ובלעדיה לא ניתן לשריין פריט.',
    },
    {
      p: 'המספר נאסף בשיחה באינסטגרם, אך נשמר במסד נתונים שבשליטתנו לצורך יצירת קשר בנוגע לאותו שריון. הוא אינו מוצג באתר, אינו נמסר לצדדים שלישיים ואינו משמש לדיוור פרסומי.',
    },
    { h: 'שירותים חיצוניים' },
    { p: 'האתר עושה שימוש בשירותים הבאים, שחלקם שומרים מידע בשרתים מחוץ לישראל, לרבות בארצות הברית:' },
    {
      ul: [
        'Google Analytics ו‑Google Tag Manager — מדידת שימוש באתר. השירות עושה שימוש בעוגיות.',
        'PostHog — מדידת שימוש באתר. האתר מוגדר שלא ליצור פרופיל אישי עבור מבקרים אנונימיים.',
        'Netlify — אחסון האתר והגשתו.',
        'Supabase — אחסון קטלוג הפריטים ומספרי הטלפון שנמסרו לשריון.',
        'Meta — ווטסאפ ואינסטגרם, שדרכם מתנהלת ההתקשרות עם לקוחות. השימוש בהם כפוף גם למדיניות הפרטיות של Meta.',
      ],
    },
    { h: 'עוגיות' },
    {
      p: 'עוגיות הן קבצים קטנים שנשמרים בדפדפן. באתר זה הן משמשות למדידת שימוש בלבד — לא לפרסום ולא להתאמת מודעות. ניתן לחסום עוגיות בהגדרות הדפדפן; חסימתן לא תפגע ביכולת לגלוש באתר ולרכוש.',
    },
    { h: 'הזכויות שלכם' },
    {
      p: 'על פי חוק הגנת הפרטיות, התשמ״א‑1981, אתם רשאים לפנות אלינו ולבקש לעיין במידע שנשמר עליכם, לתקן מידע שאינו נכון, או לבקש את מחיקתו. פנייה בנושא תיענה תוך זמן סביר.',
    },
    { p: `לפניות בנושא מידע אישי: ${EMAIL}` },
    { h: 'אבטחה' },
    {
      p: 'המידע נשמר אצל ספקי אחסון מקובלים, והגישה אליו מוגבלת. אנו נוקטים אמצעים סבירים להגנה עליו, אך אין באפשרותנו להבטיח הגנה מוחלטת מפני כל סיכון.',
    },
    { h: 'שינויים' },
    { p: `מדיניות זו עשויה להתעדכן. מועד העדכון האחרון מופיע בתחתית העמוד.` },
  ],
};

const TERMS: Doc = {
  title: 'תקנון ותנאי רכישה',
  lead: `האתר מציג פריטי וינטג׳ למכירה. הרכישה עצמה אינה מתבצעת באתר אלא בשיחה ישירה בווטסאפ. תקנון זה חל על השימוש באתר ועל רכישות שנעשות בעקבותיו.`,
  blocks: [
    { h: 'פרטי העוסק' },
    {
      ul: [
        `שם: ⟦שם העוסק המלא כפי שהוא רשום⟧`,
        `מספר עוסק / ת.ז.: ⟦למילוי⟧`,
        `כתובת: ${ADDRESS}`,
        `טלפון: ${PHONE}`,
        `דוא״ל: ${EMAIL}`,
      ],
    },
    { h: 'הפריטים' },
    {
      p: 'כל הפריטים באתר הם פריטי וינטג׳ משומשים, וכל פריט הוא יחיד במלאי. פריטי וינטג׳ עשויים לשאת סימני שימוש קלים המתאימים לגילם, ואלה אינם נחשבים פגם.',
    },
    {
      p: 'התמונות מצולמות על ידינו ומשקפות את הפריט עצמו. ייתכנו הבדלי גוון בין המסך לפריט בפועל.',
    },
    {
      p: 'המידות המצוינות הן המידות המוטבעות על הפריט. מידות וינטג׳ אינן זהות למידות של היום, ומומלץ לוודא מול המידות בפועל לפני רכישה.',
    },
    { h: 'הזמנה ותשלום' },
    {
      p: 'לחיצה על כפתור הרכישה פותחת שיחת ווטסאפ. ההזמנה נסגרת בשיחה זו, לרבות אופן התשלום ופרטי המסירה. פריט אינו נחשב שמור עד לאישור מפורש מצידנו.',
    },
    {
      p: 'המחירים המוצגים באתר כוללים מע״מ אם חל, ואינם כוללים דמי משלוח.',
    },
    { h: 'משלוח ואיסוף' },
    {
      ul: [
        'משלוח מבוצע תוך 3 עד 7 ימי עסקים ממועד אישור ההזמנה.',
        `איסוף עצמי מ${ADDRESS} — בתיאום מראש.`,
        'עלות ואופן המשלוח: ⟦למילוי⟧',
      ],
    },
    {
      p: 'זמני המשלוח תלויים בחברת השילוח ועשויים להתארך בתקופות עומס או בנסיבות שאינן בשליטתנו.',
    },
    { h: 'ביטול עסקה, החלפות והחזרות' },
    {
      note: 'זהו הסעיף שיש להביא לעורך דין לפני פרסום — ראו ההערה שנמסרה לבעל האתר.',
    },
    {
      p: 'על פי חוק הגנת הצרכן, התשמ״א‑1981 והתקנות מכוחו, בעסקת מכר מרחוק עומדת לצרכן זכות לבטל את העסקה בתוך 14 ימים מיום קבלת הפריט או מיום קבלת מסמך פרטי העסקה, לפי המאוחר. הזכות הזו קבועה בחוק ואין באמור בתקנון זה כדי לגרוע ממנה.',
    },
    {
      p: 'ביטול ייעשה בפנייה בטלפון, בדוא״ל או בווטסאפ. בביטול שאינו עקב פגם או אי‑התאמה, רשאים אנו לגבות דמי ביטול בשיעור הקבוע בחוק, והחזרת הפריט היא באחריות הרוכש ועל חשבונו.',
    },
    {
      p: 'פריט שמוחזר יימסר במצב שבו נשלח. מדידה אינה נחשבת שימוש. פריט שנלבש בפועל, נכבס, שונה או ניזוק לאחר קבלתו — רשאים אנו שלא לקבלו, או לקבלו ולנכות מסכום ההחזר את ירידת הערך שנגרמה.',
    },
    {
      p: 'האמור בפסקה זו אינו חל על ביטול עקב פגם או אי‑התאמה בין הפריט לבין מה שהוצג באתר. במקרה כזה נקבל את הפריט חזרה, נישא בעלות ההחזרה ולא ייגבו דמי ביטול — גם אם הפריט נלבש.',
    },
    {
      p: 'מאחר שמדובר בפריטי וינטג׳ משומשים, אנו מתעדים את מצב הפריט בצילום במועד המשלוח, וצילום זה משמש להשוואה בעת החזרה.',
    },
    { h: 'תווית ההחזרה' },
    {
      p: 'לכל פריט מוצמדת תווית פלסטיק חד‑פעמית, הנקרעת עם הסרתה ואינה ניתנת לחיבור מחדש. ניתן ורצוי למדוד את הפריט כשהתווית מחוברת — היא אינה מפריעה למדידה — ואנו מבקשים שלא להסירה עד להחלטה סופית.',
    },
    {
      // The tag is evidence, not a waiver. Written this way on purpose: a
      // clause claiming that removing it forfeits a statutory right would be
      // void, and publishing a void clause is worse than publishing none —
      // it turns "I did not know" into "I declared".
      p: 'תווית שהוסרה מעידה על שימוש בפריט מעבר למדידה, ואנו רשאים להביא זאת בחשבון בבחינת בקשה לביטול מחמת חרטה. אין באמור כדי לגרוע מזכות הביטול הקבועה בחוק.',
    },
    {
      p: 'התווית אינה רלוונטית לביטול עקב פגם או אי‑התאמה. פריט שהתגלה בו פגם יתקבל חזרה גם אם התווית הוסרה — פגם בתפר או במידה אינו ניתן לגילוי בלי ללבוש את הפריט.',
    },
    {
      p: 'בנוסף לזכות שבחוק, ומעבר לה, אנו מאפשרים החלפת פריט בפריט אחר בתיאום מראש, בכפוף לזמינות המלאי. מאחר שכל פריט הוא יחיד, לא תמיד קיימת חלופה זהה.',
    },
    { h: 'זמינות ומחירים' },
    {
      p: 'האתר מציג את המלאי כפי שהוא ידוע לנו במועד הצפייה. פריט עשוי להימכר בין רגע הצפייה לרגע הפנייה. במקרה של טעות בהצגת מחיר או מלאי, נעדכן אתכם ותהיו רשאים לבטל את ההזמנה ללא חיוב.',
    },
    { h: 'קניין רוחני' },
    {
      p: 'התמונות, הטקסטים והעיצוב באתר הם רכושנו. אין להעתיק או לעשות בהם שימוש מסחרי ללא אישור בכתב. שמות המותגים המופיעים באתר הם סימני מסחר של בעליהם, והשימוש בהם נועד לתיאור הפריט בלבד.',
    },
    { h: 'דין וסמכות שיפוט' },
    {
      p: 'על תקנון זה יחולו דיני מדינת ישראל, וסמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים במדינת ישראל.',
    },
  ],
};

const ACCESSIBILITY: Doc = {
  title: 'הצהרת נגישות',
  lead: `אנו רואים חשיבות בכך שהאתר יהיה שמיש עבור כל אדם, לרבות אנשים עם מוגבלות, ופועלים לשיפורו באופן שוטף.`,
  blocks: [
    { h: 'מה נעשה באתר' },
    { p: 'האתר נבדק ותוקן בהתאם לעקרונות תקן הנגישות, ובכלל זה:' },
    {
      ul: [
        'ניגודיות צבעים של 4.5:1 לפחות בכל הטקסטים באתר, ורוב הטקסט בגודל 14 פיקסלים ומעלה.',
        'כפתורים ואזורי לחיצה בגודל 44 פיקסלים לפחות, כדי שניתן יהיה להפעילם בקלות במגע.',
        'טקסט חלופי לכל תמונת פריט, כך שקורא מסך יוכל לתאר אותה.',
        'ניווט מלא באמצעות מקלדת, עם סימון ברור של הרכיב שבמיקוד.',
        'מבנה כותרות תקין וסימון תפקידים לרכיבים אינטראקטיביים.',
        'כיבוד העדפת המערכת להפחתת אנימציות — מי שהגדיר זאת במכשירו לא יראה אנימציות מתמשכות.',
        'תמיכה בהגדלת טקסט דרך הדפדפן, ובגלישה במסכים בכל הגדלים.',
      ],
    },
    { h: 'מה עדיין לא מושלם' },
    {
      p: 'האתר כולל רכיב תצוגה נגלל של פריטים מובילים, המופעל בגרירה או בחיצים. אנו ממשיכים לבחון את התנהגותו בטכנולוגיות מסייעות. כמו כן, חלק מהתיאורים המילוליים של הפריטים קצרים ואנו בתהליך הרחבתם.',
    },
    { h: 'איסוף עצמי' },
    {
      p: `האיסוף העצמי מ${ADDRESS} מתבצע בתיאום מראש. נשמח לתאם מענה שיתאים לצרכים שלכם — פנו אלינו בטלפון או בדוא״ל.`,
    },
    { h: 'נתקלתם בבעיה? כך פונים אלינו' },
    {
      p: 'אם נתקלתם בקושי בשימוש באתר, נשמח שתספרו לנו מה קרה, באיזה עמוד ובאיזה מכשיר. נטפל בפנייה ונשיב תוך זמן סביר.',
    },
    {
      // Not a "רכז נגישות". That is a formal role the law requires of public
      // bodies and of businesses above roughly twenty-five employees — not of
      // a shop this size. What a statement needs is a way to reach someone,
      // and an address and a phone number are exactly that; a personal name
      // goes in once the business is registered under one.
      ul: [`דוא״ל: ${EMAIL}`, `טלפון: ${PHONE}`],
    },
  ],
};

const DOCS: Record<PageId, Doc> = {
  privacy: PRIVACY,
  terms: TERMS,
  accessibility: ACCESSIBILITY,
};

/**
 * The documents the footer offers, and the reason one of them is missing.
 *
 * The terms still carry ⟦…⟧ where the seller's registration number and the
 * delivery charge belong, and a published document with holes in it is worse
 * than an absent one — it is a statement rather than an omission. The route
 * stays reachable so the draft can be read and sent to a lawyer; it is only
 * the link that waits.
 *
 * Add the terms row here once those two are filled in.
 */
export const FOOTER_LEGAL_LINKS: { to: string; label: string }[] = [
  { to: '/privacy', label: 'מדיניות פרטיות' },
  { to: '/accessibility', label: 'הצהרת נגישות' },
];

export default function LegalPage({ page }: { page: PageId }) {
  const doc = DOCS[page];

  const back = (event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate('/');
  };

  return (
    <article dir="rtl" className="max-w-3xl mx-auto text-right" id={`legal-${page}`}>
      <a
        href="/"
        onClick={back}
        className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-stone-600 hover:text-stone-900 transition-colors no-underline"
      >
        <ArrowRight className="w-4 h-4" />
        <span>חזרה לחנות</span>
      </a>

      <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-stone-900 leading-tight">
        {doc.title}
      </h1>
      <p className="mt-3 text-base text-stone-700 leading-relaxed">{doc.lead}</p>

      <div className="mt-8 space-y-5">
        {doc.blocks.map((block, i) => {
          if ('h' in block) {
            return (
              <h2 key={i} className="text-lg font-bold text-stone-900 pt-3">
                {block.h}
              </h2>
            );
          }
          if ('ul' in block) {
            return (
              <ul key={i} className="list-disc pr-5 space-y-2 text-base text-stone-700 leading-relaxed">
                {block.ul.map((line, j) => (
                  <li key={j}>{line}</li>
                ))}
              </ul>
            );
          }
          if ('note' in block) {
            return (
              <p
                key={i}
                className="text-sm text-amber-900 bg-amber-50 border border-amber-200 p-3 leading-relaxed"
              >
                {block.note}
              </p>
            );
          }
          return (
            <p key={i} className="text-base text-stone-700 leading-relaxed">
              {block.p}
            </p>
          );
        })}
      </div>

      <p className="mt-10 pt-5 border-t border-stone-200 text-sm text-stone-500">
        עודכן לאחרונה: {UPDATED}
      </p>
    </article>
  );
}

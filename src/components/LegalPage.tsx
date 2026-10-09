import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { navigate, type LegalPage as PageId } from '../router';
import { isEnglish, tr } from '../i18n';

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
// Nothing here is a placeholder any more. Two things once were — the seller's
// registered name and number, and the delivery charge — and both are now
// settled rather than guessed: the registration lines came out at the owner's
// instruction, and the postage is quoted in the conversation that closes the
// order, which is what actually happens.

const SHOP = 'HIGHTIDE VINTAGE';
const EMAIL = 'hightide1622@gmail.com';
const PHONE = '052-8879922';
const ADDRESS = 'הגבעה 28, כפר האורנים';
const UPDATED = 'אוקטובר 2026';

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
    // Who holds the data. A privacy notice that never says whose notice it is
    // leaves the reader with rights and nobody to exercise them against; the
    // address and the two ways to reach us are the part that makes the section
    // below usable. The registered name and number belong here too, and go in
    // with the ones in the terms.
    { h: 'מי אוסף את המידע' },
    {
      p: `האתר מופעל על ידי ${SHOP}, והיא בעלת השליטה במידע המתואר כאן.`,
    },
    {
      ul: [`כתובת: ${ADDRESS}`, `טלפון: ${PHONE}`, `דוא״ל: ${EMAIL}`],
    },
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
        'Cloudflare — אחסון קטלוג הפריטים ומספרי הטלפון שנמסרו לשריון, במסד נתונים שבשליטתנו.',
        'ManyChat — ניהול השיחה האוטומטית בהודעות אינסטגרם, שדרכה מועבר אלינו מספר הטלפון לשריון.',
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
    { h: 'פרטי החנות' },
    {
      ul: [
        `שם: ${SHOP}`,
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
        'משלוח מבוצע תוך 2 עד 7 ימי עסקים ממועד אישור ההזמנה.',
        `איסוף עצמי מ${ADDRESS} — בתיאום מראש.`,
        'עלות המשלוח ואופן המסירה נמסרים בשיחת הווטסאפ ומאושרים על ידכם לפני סגירת ההזמנה.',
      ],
    },
    {
      p: 'זמני המשלוח תלויים בחברת השילוח ועשויים להתארך בתקופות עומס או בנסיבות שאינן בשליטתנו.',
    },
    { h: 'ביטול עסקה, החלפות והחזרות' },
    // The owner's note that this section wants a lawyer's eye used to be
    // printed here, in an amber box, on the public page — an instruction to
    // the shopkeeper is not a term of sale, and an outside review read it as
    // the page announcing itself a draft. It is said here instead, where it
    // was always meant to be read.
    {
      p: 'על פי חוק הגנת הצרכן, התשמ״א‑1981 והתקנות מכוחו, בעסקת מכר מרחוק עומדת לצרכן זכות לבטל את העסקה בתוך 14 ימים מיום קבלת הפריט או מיום קבלת מסמך פרטי העסקה, לפי המאוחר. הזכות הזו קבועה בחוק ואין באמור בתקנון זה כדי לגרוע ממנה.',
    },
    {
      p: 'ביטול ייעשה בפנייה בטלפון, בדוא״ל או בווטסאפ. בביטול שאינו עקב פגם או אי‑התאמה, רשאים אנו לגבות דמי ביטול בשיעור הקבוע בחוק, והחזרת הפריט היא באחריות הרוכש ועל חשבונו.',
    },
    {
      p: 'פריט שמוחזר יימסר במצב שבו נשלח. מדידה אינה נחשבת שימוש.',
    },
    {
      p: 'ביטול עקב פגם או אי‑התאמה בין הפריט לבין מה שהוצג באתר — נקבל את הפריט חזרה, נישא בעלות ההחזרה ולא ייגבו דמי ביטול.',
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
        'חלון פריט הנפתח מעל החנות מוכרז כחלון נפרד ונושא את שם הפריט, המיקוד עובר אליו ומוחזר בסגירה למקום שממנו נפתח, מקש Tab נשאר בתוכו ומקש Escape סוגר אותו.',
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

// The same three documents in English, for visitors reading the shop in
// English (see src/i18n.ts). A translation, kept line for line with the Hebrew
// above — change one, change the other. The Hebrew is the one that binds, and
// each page says so.

const ADDRESS_EN = 'HaGiv\u2019a 28, Kfar HaOranim, Israel';
const PHONE_EN = '+972 52-887-9922';
const UPDATED_EN = 'October 2026';

const PRIVACY_EN: Doc = {
  title: 'Privacy Policy',
  lead: `${SHOP} respects the privacy of the people who use this site. This page explains what information is collected, what it is for, who it is shared with, and what your rights are.`,
  blocks: [
    { h: 'Who collects the information' },
    { p: `The site is run by ${SHOP}, which controls the information described here.` },
    { ul: [`Address: ${ADDRESS_EN}`, `Phone: ${PHONE_EN}`, `Email: ${EMAIL}`] },
    { h: 'What is collected' },
    {
      p: 'The site has no sign-up form, no user account and no checkout. It does not collect your name, address or payment details.',
    },
    { p: 'What is collected:' },
    {
      ul: [
        'How the site is used — which pages and items were viewed, taps on the buy buttons, the type of device and browser, and where the visit came from.',
        'Information kept only in your own browser — your favourites and a copy of the catalogue for faster loading. It is not sent to our servers and you can delete it at any time in your browser settings.',
        'Messages you send us — when you contact us on WhatsApp, by email or by phone, we receive the contact details you gave and what you wrote.',
      ],
    },
    { h: 'Instagram messages and phone numbers' },
    {
      p: 'Alongside the site there is an automatic reply service in Instagram messages. Anyone who chooses to reserve an item through it is asked for a phone number. Giving it is your choice, and an item cannot be reserved without it.',
    },
    {
      p: 'The number is collected in the Instagram conversation and kept in a database we control, so that we can contact you about that reservation. It is not shown on the site, not passed to third parties and not used for marketing.',
    },
    { h: 'Outside services' },
    { p: 'The site uses the following services, some of which keep information on servers outside Israel, including in the United States:' },
    {
      ul: [
        'Google Analytics and Google Tag Manager — measuring how the site is used. This uses cookies.',
        'PostHog — measuring how the site is used. It is set not to build a personal profile of anonymous visitors.',
        'Netlify — hosting and serving the site.',
        'Cloudflare — storing the item catalogue and the phone numbers given for reservations, in a database we control.',
        'ManyChat — running the automatic conversation in Instagram messages, through which the reservation phone number reaches us.',
        'Meta — WhatsApp and Instagram, where we talk with customers. Their use is also subject to Meta’s privacy policy.',
      ],
    },
    { h: 'Cookies' },
    {
      p: 'Cookies are small files kept in your browser. On this site they are used only to measure use — not for advertising and not to target ads. You can block cookies in your browser settings; doing so will not stop you browsing or buying.',
    },
    { h: 'Your rights' },
    {
      p: 'Under Israel’s Protection of Privacy Law, 5741-1981, you may ask us to see the information held about you, to correct information that is wrong, or to delete it. We will answer within a reasonable time.',
    },
    { p: `For questions about personal information: ${EMAIL}` },
    { h: 'Security' },
    {
      p: 'The information is kept with established hosting providers and access to it is restricted. We take reasonable steps to protect it, but we cannot guarantee complete protection against every risk.',
    },
    { h: 'Changes' },
    { p: 'This policy may be updated. The date of the last update is at the bottom of the page.' },
  ],
};

const TERMS_EN: Doc = {
  title: 'Terms of Sale',
  lead: 'This site shows vintage items for sale. The purchase itself does not happen on the site but in a direct WhatsApp conversation. These terms apply to using the site and to purchases made through it.',
  blocks: [
    { h: 'The shop' },
    { ul: [`Name: ${SHOP}`, `Address: ${ADDRESS_EN}`, `Phone: ${PHONE_EN}`, `Email: ${EMAIL}`] },
    { h: 'The items' },
    {
      p: 'Every item on the site is a used vintage item, and each one is the only one in stock. Vintage items may show light wear in keeping with their age; this is not considered a defect.',
    },
    { p: 'We take the photographs ourselves and they show the item itself. Colours may look slightly different on screen.' },
    {
      p: 'The sizes given are the sizes printed on the item. Vintage sizes are not the same as today’s, so please check the actual measurements before buying.',
    },
    { h: 'Ordering and payment' },
    {
      p: 'The buy button opens a WhatsApp conversation. The order is completed in that conversation, including how you pay and how the item reaches you. An item is not reserved until we confirm it explicitly.',
    },
    { p: 'Prices on the site include VAT where it applies and do not include shipping.' },
    { h: 'Shipping and collection' },
    {
      ul: [
        'Shipping within Israel takes 2 to 7 business days from when the order is confirmed.',
        `Collection from ${ADDRESS_EN} — by appointment.`,
        'The shipping cost and delivery method are given in the WhatsApp conversation and approved by you before the order is completed.',
      ],
    },
    { p: 'Delivery times depend on the carrier and may be longer at busy times or for reasons outside our control.' },
    { h: 'Cancellations, exchanges and returns' },
    {
      p: 'Under Israel’s Consumer Protection Law, 5741-1981 and its regulations, a consumer in a distance sale may cancel within 14 days of receiving the item or of receiving the document setting out the sale, whichever is later. This right is set by law and nothing in these terms takes away from it.',
    },
    {
      p: 'To cancel, contact us by phone, email or WhatsApp. If the cancellation is not because of a defect or a mismatch, we may charge the cancellation fee the law allows, and returning the item is the buyer’s responsibility and at the buyer’s cost.',
    },
    { p: 'A returned item must come back in the condition it was sent in. Trying it on does not count as use.' },
    {
      p: 'If you cancel because of a defect, or because the item does not match what the site showed, we will take it back, pay for the return and charge no cancellation fee.',
    },
    {
      p: 'Because these are used vintage items, we photograph each item’s condition when it is shipped, and that photograph is used for comparison when it is returned.',
    },
    { h: 'The return tag' },
    {
      p: 'Each item carries a single-use plastic tag that breaks when removed and cannot be reattached. You can and should try the item on with the tag attached — it does not get in the way — and we ask that you leave it on until you have decided.',
    },
    {
      p: 'A removed tag shows the item was used beyond trying it on, and we may take that into account when considering a cancellation because you changed your mind. This does not take away from the right to cancel set by law.',
    },
    {
      p: 'The tag does not matter for a cancellation because of a defect or a mismatch. An item found to be defective will be taken back even if the tag was removed — a fault in a seam or in the size cannot be found without wearing it.',
    },
    {
      p: 'In addition to, and beyond, the right in law, we allow an item to be exchanged for another by arrangement, subject to stock. Since every item is one of one, there is not always an equivalent.',
    },
    { h: 'Availability and prices' },
    {
      p: 'The site shows stock as we know it when you look. An item may sell between the moment you see it and the moment you contact us. If a price or stock level is shown in error, we will tell you and you may cancel the order at no charge.',
    },
    { h: 'Intellectual property' },
    {
      p: 'The photographs, text and design of the site belong to us. They may not be copied or used commercially without written permission. Brand names on the site are the trademarks of their owners and are used only to describe the item.',
    },
    { h: 'Governing law' },
    {
      p: 'These terms are governed by the laws of the State of Israel, and the competent courts of the State of Israel have exclusive jurisdiction.',
    },
  ],
};

const ACCESSIBILITY_EN: Doc = {
  title: 'Accessibility Statement',
  lead: 'We want this site to be usable by everyone, including people with disabilities, and we keep working to improve it.',
  blocks: [
    { h: 'What has been done' },
    { p: 'The site has been checked and fixed against the principles of the accessibility standard, including:' },
    {
      ul: [
        'Colour contrast of at least 4.5:1 for all text on the site, with most text 14 pixels or larger.',
        'Buttons and tap areas at least 44 pixels in size, so they are easy to use by touch.',
        'Alternative text for every item photo, so a screen reader can describe it.',
        'Full keyboard navigation, with a clear mark on the element in focus.',
        'An item window that opens over the shop is announced as a separate window carrying the item’s name; focus moves into it and returns on closing to where it was opened from, the Tab key stays inside it and the Escape key closes it.',
        'A proper heading structure and roles marked on interactive elements.',
        'The system preference for reduced motion is respected — anyone who has set it on their device will not see continuous animation.',
        'Support for enlarging text in the browser, and for screens of every size.',
      ],
    },
    { h: 'What is not perfect yet' },
    {
      p: 'The site has a scrolling display of top items, used by dragging or with arrows. We are still testing how it behaves with assistive technology. Some item descriptions are also short, and we are expanding them.',
    },
    { h: 'Collection in person' },
    {
      p: `Collection from ${ADDRESS_EN} is by appointment. We will gladly arrange it to suit your needs — contact us by phone or email.`,
    },
    { h: 'Found a problem? How to reach us' },
    {
      p: 'If something on the site was hard to use, please tell us what happened, on which page and on which device. We will look into it and reply within a reasonable time.',
    },
    { ul: [`Email: ${EMAIL}`, `Phone: ${PHONE_EN}`] },
  ],
};

const DOCS_EN: Record<PageId, Doc> = {
  privacy: PRIVACY_EN,
  terms: TERMS_EN,
  accessibility: ACCESSIBILITY_EN,
};

/**
 * The documents the footer offers, and the reason one of them is not among
 * them.
 *
 * The terms no longer have holes in them, so what kept the link away is gone.
 * What took its place is a judgement that belongs to the owner rather than to
 * this file: a terms page linked from a shop front is the document a customer
 * is taken to have read, and this one no longer names the seller — the
 * registered name and number were removed on purpose. Reachable at /terms,
 * and linked here the day that is a decision rather than an omission.
 */
export const FOOTER_LEGAL_LINKS: { to: string; label: string; labelEn: string }[] = [
  { to: '/privacy', label: 'מדיניות פרטיות', labelEn: 'Privacy policy' },
  { to: '/accessibility', label: 'הצהרת נגישות', labelEn: 'Accessibility' },
];

export default function LegalPage({ page }: { page: PageId }) {
  const doc = isEnglish() ? DOCS_EN[page] : DOCS[page];

  const back = (event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate('/');
  };

  return (
    <article
      dir={tr('rtl', 'ltr')}
      className={`max-w-3xl mx-auto ${isEnglish() ? 'text-left' : 'text-right'}`}
      id={`legal-${page}`}
    >
      <a
        href="/"
        onClick={back}
        className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-stone-600 hover:text-stone-900 transition-colors no-underline"
      >
        {isEnglish() ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
        <span>{tr('חזרה לחנות', 'Back to the shop')}</span>
      </a>

      <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-stone-900 leading-tight">
        {doc.title}
      </h1>
      <p className="mt-3 text-base text-stone-700 leading-relaxed">{doc.lead}</p>
      {isEnglish() && (
        <p className="mt-3 text-sm text-stone-500 leading-relaxed">
          This is an English translation for your convenience. The Hebrew version is the binding one.
        </p>
      )}

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
              <ul key={i} className={`list-disc ${isEnglish() ? 'pl-5' : 'pr-5'} space-y-2 text-base text-stone-700 leading-relaxed`}>
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
        {tr(`עודכן לאחרונה: ${UPDATED}`, `Last updated: ${UPDATED_EN}`)}
      </p>
    </article>
  );
}

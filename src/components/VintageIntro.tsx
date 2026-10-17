import { tr } from '../i18n';

/** A short introduction between the editorial photograph and the clothes. */
export default function VintageIntro() {
  return (
    <section className="vintage-intro" dir={tr('rtl', 'ltr')} aria-labelledby="vintage-intro-title">
      <div className="vintage-intro-inner">
        <div>
          <p className="vintage-eyebrow" dir="ltr">OLD SCHOOL. NEW WAVE.</p>
          <h1 id="vintage-intro-title">{tr('וינטג׳ של פעם. הווייב של עכשיו.', 'Old-school pieces. A new wave.')}</h1>
        </div>
        <div className="vintage-intro-copy">
          <p>{tr('בורדיז, חולצות ואקססוריז מקוריים מתור הזהב של הגלישה. כל פריט הוא אחד ויחיד — מוצאים את שלכם וממשיכים איתו לסיפור הבא.', 'Original boardshorts, tees and accessories from the golden age of surf. Each piece is one of one. Find yours and give it its next chapter.')}</p>
          <p className="vintage-intro-facts">
            <span>{tr('וינטג׳ מקורי', 'Original vintage')}</span>
            <span aria-hidden="true">✳</span>
            <span>{tr('פריטים יחידים', 'One of one')}</span>
            <span aria-hidden="true">✳</span>
            <span>{tr('רכישה בווטסאפ', 'Shop on WhatsApp')}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

import { ArrowLeft } from 'lucide-react';

// What a product address resolves to when the shop has no such garment.
//
// Worth more care than a generic 404, because here it usually is not a broken
// link: every item is a single piece, and links live for a long time in
// Instagram DMs. The common case is that someone is opening a link to a garment
// that has since sold and been cleared. Saying that is more useful — and more
// honest about how the shop works — than "page not found".

interface ProductNotFoundProps {
  onBack: () => void;
}

export default function ProductNotFound({ onBack }: ProductNotFoundProps) {
  return (
    <section
      className="max-w-md mx-auto text-center py-20 px-4 animate-fade-in"
      dir="rtl"
      id="product-not-found"
    >
      <h1 className="text-2xl font-groovy font-normal text-stone-900">הפריט הזה כבר לא כאן</h1>
      <p className="text-sm text-stone-600 mt-4 leading-relaxed">
        כל פריט אצלנו הוא יחיד, וכשהוא נמכר הוא יורד מהחנות. אם הגעתם מקישור ישן,
        רוב הסיכויים שמישהו הקדים אתכם.
      </p>
      <p className="text-sm text-stone-600 mt-2 leading-relaxed">
        שווה להציץ במה שיש עכשיו — הדרופ מתחדש כל שבוע.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-8 inline-flex items-center gap-2 px-6 py-2.5 bg-stone-900 text-white border border-stone-900 hover:bg-stone-800 transition-colors cursor-pointer text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        לכל הפריטים
      </button>
    </section>
  );
}

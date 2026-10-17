import { useEffect, useRef, useState } from 'react';
import { onPhotoError, srcSetFor } from '../photos';
import { tr } from '../i18n';

/**
 * A garment's photos, one after another, moved between with a swipe.
 *
 * Native horizontal scrolling with snap points: the phone's own gesture, its
 * own momentum, and the page still scrolls up and down through it. Small dots
 * at the foot say how many photos there are and which one is showing.
 *
 * `lazy`: on a category page the second and third photos are not fetched until
 * a finger (or a pointer, or a scroll) touches the gallery — forty-five cards'
 * worth of angles nobody swiped to is a lot of a customer's data. The slides
 * themselves are there from the start, so the swipe has somewhere to go.
 */
interface SwipeGalleryProps {
  images: string[];
  alt: string;
  sizes: string;
  fit: 'cover' | 'contain';
  /** The photo to show, when a parent (the item page's thumbnails) steers it. */
  active?: number;
  onActiveChange?: (index: number) => void;
  lazy?: boolean;
  imgClassName?: string;
  firstImgId?: string;
  key?: string;
}

export default function SwipeGallery({
  images,
  alt,
  sizes,
  fit,
  active,
  onActiveChange,
  lazy = false,
  imgClassName = '',
  firstImgId,
}: SwipeGalleryProps) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [wanted, setWanted] = useState(!lazy);
  const many = images.length > 1;

  // Steered from outside: scroll to the photo the thumbnails asked for.
  useEffect(() => {
    const el = track.current;
    if (active === undefined || !el || active === current) return;
    setWanted(true);
    el.scrollTo({ left: active * el.clientWidth, behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    if (!wanted) setWanted(true);
    const index = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    if (index !== current) {
      setCurrent(index);
      onActiveChange?.(index);
    }
  };

  const want = many && !wanted ? () => setWanted(true) : undefined;

  return (
    <div className="relative w-full h-full">
      <div
        ref={track}
        dir="ltr"
        onScroll={many ? onScroll : undefined}
        onTouchStart={want}
        onPointerDown={want}
        onMouseEnter={want}
        className={`flex w-full h-full ${many ? 'overflow-x-auto snap-x snap-mandatory overscroll-x-contain no-scrollbar' : 'overflow-hidden'}`}
      >
        {images.map((src, i) => (
          <div key={src} className="w-full h-full shrink-0 snap-center">
            {(i === 0 || wanted) && (
              <img
                src={src}
                srcSet={srcSetFor(src)}
                sizes={sizes}
                alt={i === 0 ? alt : tr(`${alt} — תמונה ${i + 1}`, `${alt} — photo ${i + 1}`)}
                id={i === 0 ? firstImgId : undefined}
                referrerPolicy="no-referrer"
                decoding="async"
                draggable={false}
                onError={onPhotoError}
                className={`w-full h-full ${fit === 'cover' ? 'object-cover' : 'object-contain'} object-center select-none ${imgClassName}`}
              />
            )}
          </div>
        ))}
      </div>
      {many && (
        <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5 pointer-events-none" aria-hidden="true">
          {images.map((src, i) => (
            <span
              key={src}
              className={`w-1.5 h-1.5 rounded-full shadow-[0_0_2px_rgba(0,0,0,0.45)] transition-colors ${i === current ? 'bg-white' : 'bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

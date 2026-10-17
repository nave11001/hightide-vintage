import { useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { tr } from '../i18n';

/**
 * The shop's film, looping behind the homepage header.
 *
 * Cut from the owner's 145MB phone recording (a landscape film letterboxed in
 * a portrait frame): the black bars cropped off, 24fps, H.264 with its music —
 * 2.9MB for a phone, 4.7MB from 768px up. The still is the first frame and shows
 * until the film can play, and instead of it for anyone who has asked their
 * device for less motion or less data.
 *
 * A tap on the film pauses it and a second tap carries on, with nothing drawn
 * over the picture to say so: the owner wanted the film clean.
 *
 * The music: browsers play a film on their own only when it is silent, so it
 * starts muted and the sound button at the right turns the music on and off.
 * There is no way round that from a web page.
 */
export const HERO_POSTER = '/video/hero-poster.webp';

// The still instead of the film for anyone who asked their device for less
// motion, or for less data: 3MB of film is a poor trade on a capped plan.
const stillOnly =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
    Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData));

export default function HeroFilm({ still = false }: { still?: boolean }) {
  const film = useRef<HTMLVideoElement>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [playing, setPlaying] = useState(true);

  // `still`: the header above a garment opened from a shared link, where the
  // garment is the page and 3MB of film behind it is only weight.
  if (stillOnly || still) {
    return <img src={HERO_POSTER} alt="" className="absolute inset-0 w-full h-full object-cover" />;
  }

  const togglePlay = () => {
    const video = film.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  };

  const toggleSound = () => {
    const video = film.current;
    if (!video) return;
    const next = !soundOn;
    video.muted = !next;
    // Turning the music on is also a reason to be playing.
    if (next && video.paused) void video.play().catch(() => {});
    setSoundOn(next);
  };

  return (
    <>
      <video
        ref={film}
        className="absolute inset-0 w-full h-full object-cover cursor-pointer"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={HERO_POSTER}
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-hidden="true"
      >
        <source src="/video/hero-640-music.mp4" type="video/mp4" media="(max-width: 767px)" />
        <source src="/video/hero-960-music.mp4" type="video/mp4" />
      </video>

      {/* Pause for a keyboard: the tap on the film draws nothing, as the
          owner asked, so this button is invisible until it has focus — a
          looping film must be stoppable by anyone (WCAG 2.2.2). */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? tr('עצירת הסרטון', 'Pause the film') : tr('הפעלת הסרטון', 'Play the film')}
        className="sr-only focus:not-sr-only focus:absolute focus:z-30 focus:bottom-2 focus:right-14 sm:focus:bottom-5 sm:focus:right-16 focus:w-11 focus:h-11 focus:flex focus:items-center focus:justify-center focus:rounded-full focus:border focus:border-white/80 focus:bg-black/30 focus:text-white focus:text-[11px]"
      >
        {playing ? tr('עצירה', 'Pause') : tr('הפעלה', 'Play')}
      </button>

      {/* The sound switch, low on the right — the start of a Hebrew line —
          clear of the NEW DROP button in the middle. A thin ring in the
          site's delicate line, a 44px target around a 36px circle. */}
      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={soundOn}
        aria-label={tr('מוזיקה', 'Music')}
        className="absolute z-30 bottom-2 right-2 sm:bottom-5 sm:right-5 w-11 h-11 flex items-center justify-center cursor-pointer group/sound"
      >
        <span className="w-9 h-9 rounded-full border border-white/80 bg-black/15 backdrop-blur-[2px] flex items-center justify-center text-white transition-colors group-hover/sound:bg-black/30">
          {soundOn ? <Volume2 className="w-4 h-4" strokeWidth={1.5} /> : <VolumeX className="w-4 h-4" strokeWidth={1.5} />}
        </span>
      </button>
    </>
  );
}

import logoUrl from '@/assets/logo.png';

// The brand mark turning on its vertical axis, like a coin flipped on a table.
//
// Two faces rather than one: a single image rotated past 90° shows its own back,
// and the wordmark would read mirrored for half of every turn. The second copy is
// pre-rotated to meet the viewer the right way round, so the logo stays legible
// all the way through and the disc reads as solid.

interface SpinningLogoProps {
  className?: string;
  /** Seconds for one full turn. */
  seconds?: number;
}

export default function SpinningLogo({ className = 'w-16 h-16', seconds = 6 }: SpinningLogoProps) {
  return (
    <div className={`[perspective:600px] shrink-0 ${className}`} id="spinning-logo">
      <div
        className="relative w-full h-full animate-coin"
        style={{ animationDuration: `${seconds}s` }}
      >
        <img
          src={logoUrl}
          alt="Hightide Vintage"
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain select-none [backface-visibility:hidden]"
        />
        <img
          src={logoUrl}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain select-none [backface-visibility:hidden] [transform:rotateY(180deg)]"
        />
      </div>
    </div>
  );
}

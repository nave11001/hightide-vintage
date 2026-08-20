// The splash is the white screen with the logo that index.html paints on its
// very first frame, before a byte of this bundle has run. It exists to cover
// the crawler fallback text inside #root, which the browser would otherwise
// show for as long as the bundle takes to arrive.
//
// Because it lives outside the React root, React never removes it. Whoever
// takes over the screen has to say so: LiquidVeil once its sphere is drawn, or
// App when the shop is ready and no veil was ever needed. main.tsx keeps a
// deadline so a crash on mount cannot leave the site hidden behind it.

let dismissed = false;

/** Fade the static splash out. Safe to call from several places, and twice. */
export function dismissSplash() {
  if (dismissed) return;
  dismissed = true;

  const el = document.getElementById('splash');
  if (!el) return;

  el.style.opacity = '0';
  // Matches the transition in index.html. Removed rather than left at zero, so
  // it stops covering clicks. The scroll lock is released at the same moment
  // rather than at the start of the fade, so the scrollbar cannot come back and
  // nudge the fading logo sideways.
  window.setTimeout(() => {
    el.remove();
    document.documentElement.classList.remove('splash-open');
  }, 260);
}

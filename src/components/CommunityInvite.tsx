import type { MouseEvent } from 'react';
import { tr } from '../i18n';

/**
 * "Liked what you saw?" — the invitation to the shop's Instagram channel,
 * at the foot of every page above the footer.
 *
 * A card on the shop's backdrop (the same wave the garments stand on), white
 * type, and a transparent button in the site's thin line — the owner chose it
 * from three.
 *
 * The link is the channel's own address, which the owner chose: the invite
 * link (ig.me/j/…) opened Instagram's web join page in the browser inside
 * Instagram instead of the channel. On a phone it has to reach the Instagram
 * app, not a web page: it opens in the same tab (a new tab keeps it on the
 * web), and on Android it is handed to the app by name, with the web page as
 * the fallback when the app is not installed.
 */
export const COMMUNITY_URL = 'https://www.instagram.com/channel/AbZl2_mFcdzxqA6l/';
const ANDROID_INTENT = `intent://www.instagram.com/channel/AbZl2_mFcdzxqA6l/#Intent;scheme=https;package=com.instagram.android;S.browser_fallback_url=${encodeURIComponent(COMMUNITY_URL)};end`;

function openCommunity(event: MouseEvent<HTMLAnchorElement>) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  const phone = window.matchMedia('(pointer: coarse)').matches;
  if (!phone) return;
  event.preventDefault();
  window.location.href = /Android/i.test(navigator.userAgent) ? ANDROID_INTENT : COMMUNITY_URL;
}

function InstagramGlyph({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="17.6" cy="6.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

const heading = () => tr('אהבתם מה שראיתם?', 'Like what you see?');
const line = () => tr('הנה קישור לקהילה שלנו לעדכונים נוספים', 'Join our community for more updates');
const linkProps = { href: COMMUNITY_URL, target: '_blank', rel: 'noopener noreferrer' } as const;

export default function CommunityInvite() {
  return (
    <section dir={tr('rtl', 'ltr')} className="relative overflow-hidden rounded-[14px] min-h-[240px] sm:min-h-[280px] flex flex-col justify-end items-start gap-2 p-6 sm:p-10 text-white" aria-label={heading()}>
      <div className="absolute inset-0 bg-[url('/backdrop.webp')] bg-cover bg-center" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,26,30,0.8)] to-[rgba(8,26,30,0.12)]" aria-hidden="true" />
      <h2 className="relative text-[25px] sm:text-[32px] font-normal leading-tight">{heading()}</h2>
      <p className="relative text-[15px] sm:text-base font-light opacity-95">{line()}</p>
      <a {...linkProps} onClick={openCommunity} className="relative mt-2 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[10px] border border-white/90 text-sm tracking-wide hover:bg-white/10 transition-colors no-underline">
        <InstagramGlyph />
        {tr('להצטרף לקהילה', 'Join the community')}
      </a>
    </section>
  );
}

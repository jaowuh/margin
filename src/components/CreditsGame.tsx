import { useEffect, useRef } from 'react';
import wmUrl from '../assets/margin-letters.png';
import creditsUrl from '../assets/credits-by-dr-jao.png';
import { mountCreditsGame } from './creditsGameEngine';

/** Hidden game: hold the top "margin." logo. The card below is only the painting area;
 *  the line, light-up and credits play on the logo itself (drawn by the engine). */
export default function CreditsGame() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const holds = Array.from(document.querySelectorAll<HTMLElement>('.wordmark'));
    holds.forEach(el => el.classList.add('cg-hold'));
    const stop = mountCreditsGame(root.current, holds, wmUrl, creditsUrl);
    return () => { stop(); holds.forEach(el => { el.classList.remove('cg-hold'); el.style.opacity = ''; }); };
  }, []);
  return (
    <div className="card cg-card" ref={root} data-cg="card" aria-hidden="true">
      <div className="cg-play-in" data-cg="playIn">
        <div className="cg-dh">
          <span className="cg-shape" data-cg="shapeName" />
          <button type="button" className="cg-close" tabIndex={-1} data-cg="closeBtn" aria-label="Pause">×</button>
        </div>
        <div className="cg-cov"><i data-cg="covFill" /></div>
        <canvas className="cg-paint" data-cg="paint" />
      </div>
    </div>
  );
}

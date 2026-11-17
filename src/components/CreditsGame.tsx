import { useEffect, useRef } from 'react';
import wmUrl from '../assets/margin-letters.png';
import creditsUrl from '../assets/credits-by-dr-jao.png';
import { mountCreditsGame } from './creditsGameEngine';

/** The big logo. Hold it to start the hidden coloring minigame. */
export default function CreditsGame() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const holds = Array.from(document.querySelectorAll<HTMLElement>('.wordmark'));
    holds.forEach(el => el.classList.add('cg-hold'));
    const stop = mountCreditsGame(root.current, holds, wmUrl, creditsUrl);
    return () => { stop(); holds.forEach(el => el.classList.remove('cg-hold', 'cg-trophy')); };
  }, []);
  return (
    <div className="card cg-card" aria-hidden="true" ref={root} data-cg="card">
      <div className="cg-logo" data-cg="logo">
        <canvas className="cg-stage" data-cg="stage" role="img" aria-label="margin" />
      </div>
      <div className="cg-hint" data-cg="hint" aria-live="polite" />
      <div className="cg-margin" data-cg="marginTxt" />
      <div className="cg-play" data-cg="play">
        <div className="cg-play-in" data-cg="playIn">
          <div className="cg-dh">
            <span className="cg-shape" data-cg="shapeName" />
            <button type="button" className="cg-close" tabIndex={-1} data-cg="closeBtn" aria-label="Pause">×</button>
          </div>
          <div className="cg-cov"><i data-cg="covFill" /></div>
          <canvas className="cg-paint" data-cg="paint" />
        </div>
      </div>
      <svg className="cg-line" data-cg="lineSvg" aria-hidden="true">
        <path data-cg="inkBase" fill="none" stroke="#3a3431" strokeLinecap="round" strokeLinejoin="round" />
        <path data-cg="inkLine" fill="none" stroke="#D9895F" strokeLinecap="round" strokeLinejoin="round" />
        <line data-cg="tick" stroke="#F5F5F4" strokeWidth="2.5" />
      </svg>
      <canvas className="cg-fx" data-cg="fxc" aria-hidden="true" />
    </div>
  );
}

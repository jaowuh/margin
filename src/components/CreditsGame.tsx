import { useEffect, useRef } from 'react';
import wmUrl from '../assets/margin-letters.png';
import creditsUrl from '../assets/credits-by-dr-jao.png';
import { mountCreditsGame } from './creditsGameEngine';

/** The big logo. Hold it to start the hidden coloring minigame. */
export default function CreditsGame() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    return mountCreditsGame(root.current, wmUrl, creditsUrl);
  }, []);
  return (
    <div className="card cg-card" ref={root} data-cg="card">
      <div className="card-head"><div><h2>About</h2></div></div>
      <div className="cg-logo" data-cg="logo">
        <canvas className="cg-stage" data-cg="stage" role="img" aria-label="margin" />
      </div>
      <div className="cg-hint" data-cg="hint" aria-live="polite" />
      <div className="cg-margin" data-cg="marginTxt" />
      <div className="cg-play" data-cg="play">
        <div className="cg-play-in" data-cg="playIn">
          <div className="cg-dh">
            <span className="cg-shape" data-cg="shapeName" />
            <button type="button" className="cg-close" data-cg="closeBtn" aria-label="Pause">×</button>
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
      <button type="button" className="cg-replay" data-cg="replayLnk" style={{ display: 'none' }}>Replay credits</button>
      <p className="muted-text small center cg-ver">Margin v1.0 · Data stays on this device · No account, no tracking</p>
    </div>
  );
}

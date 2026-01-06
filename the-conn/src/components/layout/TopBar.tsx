import { useEffect, useRef } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import type { TimeScale } from '../../store/useSubmarineStore';

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const TimeControls = () => {
  const timeScale = useSubmarineStore(state => state.timeScale);
  const setTimeScale = useSubmarineStore(state => state.setTimeScale);

  const scales: TimeScale[] = ['FAST', 'MED', 'SLOW'];

  return (
    <div className="flex gap-1">
      {scales.map(scale => (
        <button
          key={scale}
          onClick={() => setTimeScale(scale)}
          className={`px-1.5 py-0.5 text-[10px] font-mono border rounded ${
            timeScale === scale
              ? 'bg-amber-900/50 text-amber-500 border-amber-700'
              : 'bg-transparent text-zinc-600 border-zinc-800 hover:text-zinc-400'
          }`}
        >
          {scale}
        </button>
      ))}
    </div>
  );
};

export const TopBar = () => {
  const timeRef = useRef<HTMLSpanElement>(null);
  const headingRef = useRef<HTMLSpanElement>(null);
  const speedRef = useRef<HTMLSpanElement>(null);
  const depthRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Initial Update
    const state = useSubmarineStore.getState();
    if (timeRef.current) timeRef.current.innerText = formatTime(state.gameTime);
    if (headingRef.current) headingRef.current.innerText = Math.round(state.heading).toString().padStart(3, '0');
    if (speedRef.current) speedRef.current.innerText = state.speed.toFixed(1);
    if (depthRef.current) depthRef.current.innerText = Math.round(state.depth).toString().padStart(4, '0');

    const unsub = useSubmarineStore.subscribe((state) => {
      if (timeRef.current) timeRef.current.innerText = formatTime(state.gameTime);
      if (headingRef.current) headingRef.current.innerText = Math.round(state.heading).toString().padStart(3, '0');
      if (speedRef.current) speedRef.current.innerText = state.speed.toFixed(1);
      if (depthRef.current) depthRef.current.innerText = Math.round(state.depth).toString().padStart(4, '0');
    });

    return unsub;
  }, []);

  return (
    <div className="w-full h-14 bg-bulkhead bg-noise z-50 border-b border-white/10 shadow-lg flex items-center px-6 font-mono text-zinc-300 select-none flex-shrink-0">

      {/* TIME */}
      <div className="flex flex-col mr-8">
        <span className="text-[10px] text-zinc-500 leading-none mb-1">SIM TIME</span>
        <span ref={timeRef} className="text-xl text-amber-500 tracking-wider">
          00:00:00
        </span>
      </div>

      {/* HEADING */}
      <div className="flex flex-col mr-8 border-l border-white/5 pl-6 h-full justify-center">
         <div className="flex items-baseline gap-1">
            <span ref={headingRef} className="text-2xl text-white font-bold">
              000
            </span>
         </div>
         <span className="text-[10px] text-zinc-500 leading-none">HDG</span>
      </div>

      {/* SPEED */}
      <div className="flex flex-col mr-8 border-l border-white/5 pl-6 h-full justify-center">
         <div className="flex items-baseline gap-1">
            <span ref={speedRef} className="text-2xl text-white font-bold">
              0.0
            </span>
            <span className="text-xs text-zinc-500">KTS</span>
         </div>
         <span className="text-[10px] text-zinc-500 leading-none">SPEED</span>
      </div>

      {/* DEPTH */}
      <div className="flex flex-col mr-8 border-l border-white/5 pl-6 h-full justify-center">
         <div className="flex items-baseline gap-1">
            <span ref={depthRef} className="text-2xl text-white font-bold">
              0000
            </span>
            <span className="text-xs text-zinc-500">FT</span>
         </div>
         <span className="text-[10px] text-zinc-500 leading-none">DEPTH</span>
      </div>

      {/* TIME SCALE CONTROLS */}
      <div className="ml-auto flex flex-col items-end justify-center h-full border-l border-white/5 pl-6">
          <span className="text-[10px] text-zinc-500 leading-none mb-1">TIMESCALE</span>
          <TimeControls />
      </div>

    </div>
  );
};

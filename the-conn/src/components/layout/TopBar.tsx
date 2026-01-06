import { useEffect, useRef, useState } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { ScenarioManager } from '../debug/ScenarioManager';
import { loadAmbushScenario } from '../../scenarios/Ambush';
import type { ViewScale } from '../../store/useSubmarineStore';
import { LogHistory } from './LogHistory';

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const TimeControls = () => {
  const viewScale = useSubmarineStore(state => state.viewScale);
  const setViewScale = useSubmarineStore(state => state.setViewScale);

  const scales: ViewScale[] = ['FAST', 'MED', 'SLOW'];

  return (
    <div className="flex gap-1">
      {scales.map(scale => (
        <button
          key={scale}
          onClick={() => setViewScale(scale)}
          className={`px-1.5 py-0.5 text-[10px] font-mono border rounded ${
            viewScale === scale
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
  const [showScenarioManager, setShowScenarioManager] = useState(false);
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [flash, setFlash] = useState(false);

  // Subscribe to latest log for ticker
  const latestLog = useSubmarineStore(state => state.logs[state.logs.length - 1]);

  useEffect(() => {
    if (latestLog) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 500);
      return () => clearTimeout(timer);
    }
  }, [latestLog]);

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
      {showScenarioManager && <ScenarioManager onClose={() => setShowScenarioManager(false)} />}

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

      {/* MESSAGE TICKER */}
      <div className="flex-grow flex justify-center items-center relative h-full mx-4">
        <button
            onClick={() => setShowHistory(!showHistory)}
            className={`font-mono text-sm truncate max-w-[600px] transition-all duration-300 outline-none ${
                flash
                  ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] scale-105'
                  : 'text-amber-500 hover:text-amber-400'
            }`}
        >
            {latestLog ? latestLog.message : "SYSTEM READY"}
        </button>
        {showHistory && <LogHistory onClose={() => setShowHistory(false)} />}
      </div>

      {/* TIME SCALE CONTROLS */}
      <div className="ml-auto flex flex-col items-end justify-center h-full border-l border-white/5 pl-6">
          <span className="text-[10px] text-zinc-500 leading-none mb-1">TIMESCALE</span>
          <div className="flex gap-4 items-center relative">
            <TimeControls />

            <div className="relative">
                <button
                    onClick={() => setShowScenarioMenu(!showScenarioMenu)}
                    className="text-[10px] bg-blue-900/50 text-blue-300 border border-blue-800 px-2 py-0.5 rounded hover:bg-blue-900 hover:text-white"
                >
                    SCENARIO
                </button>
                {showScenarioMenu && (
                    <div className="absolute top-full right-0 mt-2 w-32 bg-zinc-900 border border-zinc-700 rounded shadow-xl py-1 z-50">
                        <button
                            onClick={() => {
                                useSubmarineStore.getState().loadScenario({ contacts: [] });
                                setShowScenarioMenu(false);
                            }}
                            className="w-full text-left px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                        >
                            Clear World
                        </button>
                        <button
                            onClick={() => {
                                loadAmbushScenario();
                                setShowScenarioMenu(false);
                            }}
                            className="w-full text-left px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                        >
                            Ambush
                        </button>
                    </div>
                )}
            </div>

            <button
                onClick={() => setShowScenarioManager(true)}
                className="text-[10px] bg-red-900/50 text-red-300 border border-red-800 px-2 py-0.5 rounded hover:bg-red-900 hover:text-white"
            >
                DEV
            </button>
          </div>
      </div>

    </div>
  );
};

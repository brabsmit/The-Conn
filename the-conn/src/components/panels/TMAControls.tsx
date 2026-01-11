import { useSubmarineStore } from '../../store/useSubmarineStore';
import { calculateProjectedSolution, calculateSolutionCPA } from '../../lib/tma';
import { RotaryKnob } from '../RotaryKnob';
import { useEffect, useState, useRef } from 'react';

export const TMAControls = () => {
  const selectedTrackerId = useSubmarineStore((state) => state.selectedTrackerId);
  const trackers = useSubmarineStore((state) => state.trackers);
  const updateTrackerSolution = useSubmarineStore((state) => state.updateTrackerSolution);
  const addSolutionLeg = useSubmarineStore((state) => state.addSolutionLeg);
  const gameTime = useSubmarineStore((state) => state.gameTime);
  const setSelectedTrackerId = useSubmarineStore((state) => state.setSelectedTracker);

  // Ownship State
  const x = useSubmarineStore((state) => state.x);
  const y = useSubmarineStore((state) => state.y);
  const heading = useSubmarineStore((state) => state.heading);
  const speed = useSubmarineStore((state) => state.speed);
  const ownShip = { x, y, heading };
  const ownShipFull = { x, y, heading, speed };

  const selectedTracker = trackers.find((t) => t.id === selectedTrackerId);

  // Local state for selected leg
  const [selectedLegIndex, setSelectedLegIndex] = useState<number>(0);

  // Refs for event handler access without re-binding
  const trackersRef = useRef(trackers);
  const selectedTrackerIdRef = useRef(selectedTrackerId);

  useEffect(() => {
    trackersRef.current = trackers;
    selectedTrackerIdRef.current = selectedTrackerId;
  }, [trackers, selectedTrackerId]);

  useEffect(() => {
    if (selectedTracker && selectedTracker.solution.legs) {
        setSelectedLegIndex(selectedTracker.solution.legs.length - 1);
    }
  }, [selectedTracker?.id, selectedTracker?.solution.legs?.length]);

  // Keyboard Shortcuts for Cycling Trackers
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === '[' || e.key === ']') {
              // Access state from refs to avoid stale closures without dependency thrashing
              const currentTrackers = trackersRef.current;
              const currentSelectedId = selectedTrackerIdRef.current;
              const setSelected = useSubmarineStore.getState().setSelectedTracker;

              const activeTrackers = currentTrackers.filter(t => t.kind !== 'WEAPON');
              if (activeTrackers.length === 0) return;

              const currentIdx = currentSelectedId ? activeTrackers.findIndex(t => t.id === currentSelectedId) : -1;
              let nextIdx = -1;

              if (e.key === '[') {
                  nextIdx = currentIdx - 1;
                  if (nextIdx < 0) nextIdx = activeTrackers.length - 1;
              } else {
                  nextIdx = currentIdx + 1;
                  if (nextIdx >= activeTrackers.length) nextIdx = 0;
              }

              if (activeTrackers[nextIdx]) {
                  setSelected(activeTrackers[nextIdx].id);
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty dependency array = mount once

  const cycleTracker = (dir: -1 | 1) => {
      const activeTrackers = trackers.filter(t => t.kind !== 'WEAPON');
      if (activeTrackers.length === 0) return;

      const currentIdx = selectedTrackerId ? activeTrackers.findIndex(t => t.id === selectedTrackerId) : -1;
      let next = currentIdx + dir;

      if (next < 0) next = activeTrackers.length - 1;
      if (next >= activeTrackers.length) next = 0;

      setSelectedTrackerId(activeTrackers[next].id);
  };

  const formatTime = (t: number | undefined) => {
      if (t === undefined) return "--:--";
      const minutes = Math.floor(t / 60);
      const seconds = Math.floor(t % 60);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Derived state for display
  const legs = selectedTracker?.solution.legs || [];
  const activeLeg = legs[selectedLegIndex] || legs[legs.length - 1];

  // Calculations (only if selectedTracker exists)
  const projected = selectedTracker ? calculateProjectedSolution(
    selectedTracker.solution as any,
    ownShip,
    gameTime
  ) : null;

  const cpa = selectedTracker ? calculateSolutionCPA(
      selectedTracker.solution as any,
      ownShipFull,
      gameTime
  ) : null;

  // Handlers
  const handleUpdateLeg = (updates: Partial<typeof activeLeg>) => {
     if (!selectedTracker || !activeLeg) return;
     const newLegs = [...legs];
     newLegs[selectedLegIndex] = { ...activeLeg, ...updates };
     updateTrackerSolution(selectedTracker.id, { legs: newLegs });
  };

  const handleMark = () => {
     if (!selectedTracker) return;
     addSolutionLeg(selectedTracker.id);
  };

  const handleReset = () => {
      if (!selectedTracker) return;
      const resetLeg = {
          startTime: gameTime,
          startRange: 10000,
          startBearing: selectedTracker.currentBearing + heading,
          course: 0,
          speed: 10,
          startOwnShip: ownShip
      };
      updateTrackerSolution(selectedTracker.id, { legs: [resetLeg] });
  };

  const handleMerge = () => {
      if (!selectedTracker || selectedLegIndex <= 0) return;
      const newLegs = legs.filter((_, i) => i !== selectedLegIndex);
      updateTrackerSolution(selectedTracker.id, { legs: newLegs });
      setSelectedLegIndex(prev => Math.max(0, prev - 1));
  };

  return (
    <div className="flex flex-col h-full bg-white/5 border-l border-white/10 overflow-hidden font-mono select-none">

        {/* HEADER / READOUT */}
        <div className="flex-none flex-shrink-0 p-3 bg-black/40 border-b border-white/10 shadow-inner shadow-black/50">
            <div className="flex justify-between items-center mb-3">
                {/* CONTACT SELECTOR */}
                <div className="flex items-center gap-1 bg-black/40 rounded border border-white/10 p-0.5">
                    <button
                        onClick={() => cycleTracker(-1)}
                        className="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-cyan-400 hover:bg-white/5 rounded text-[10px]"
                        data-testid="tracker-prev"
                    >◀</button>

                    <select
                        value={selectedTrackerId || ''}
                        onChange={(e) => setSelectedTrackerId(e.target.value)}
                        className="bg-transparent text-[10px] font-bold text-cyan-400 text-center outline-none border-none appearance-none cursor-pointer w-32"
                        data-testid="tracker-select"
                    >
                        {!selectedTrackerId && <option value="">SELECT TRK</option>}
                        {trackers.map(t => (
                            <option key={t.id} value={t.id} className="bg-zinc-900 text-zinc-300">
                                {t.id} {t.classification ? `(${t.classification.substring(0,3)})` : ''}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={() => cycleTracker(1)}
                        className="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-cyan-400 hover:bg-white/5 rounded text-[10px]"
                        data-testid="tracker-next"
                    >▶</button>
                </div>

                <div className="text-[10px] text-zinc-600">
                    {selectedTracker && activeLeg ? `DOT STACK: ${Math.round(gameTime - activeLeg.startTime)}s` : 'NO CONTACT'}
                </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
                 <div className="flex flex-col items-center">
                    <span className="text-[9px] text-zinc-500 mb-0.5">BRG</span>
                    <span className={`text-xl font-bold tabular-nums tracking-tighter drop-shadow-[0_0_2px_rgba(74,222,128,0.5)] ${projected ? 'text-green-400' : 'text-zinc-700'}`}>
                        {projected ? projected.calcBearing.toFixed(0).padStart(3, '0') : '---'}
                    </span>
                 </div>
                 <div className="flex flex-col items-center">
                    <span className="text-[9px] text-zinc-500 mb-0.5">RNG</span>
                    <span className={`text-xl font-bold tabular-nums tracking-tighter drop-shadow-[0_0_2px_rgba(74,222,128,0.5)] ${projected ? 'text-green-400' : 'text-zinc-700'}`}>
                        {projected ? (projected.calcRange / 1000).toFixed(1) + 'k' : '--.-k'}
                    </span>
                 </div>
                 <div className="flex flex-col items-center">
                    <span className="text-[9px] text-zinc-500 mb-0.5">CRS</span>
                    <span className={`text-xl font-bold tabular-nums tracking-tighter drop-shadow-[0_0_2px_rgba(74,222,128,0.5)] ${activeLeg ? 'text-green-400' : 'text-zinc-700'}`}>
                        {activeLeg ? activeLeg.course.toFixed(0).padStart(3, '0') : '---'}
                    </span>
                 </div>
                 <div className="flex flex-col items-center">
                    <span className="text-[9px] text-zinc-500 mb-0.5">SPD</span>
                    <span className={`text-xl font-bold tabular-nums tracking-tighter drop-shadow-[0_0_2px_rgba(74,222,128,0.5)] ${activeLeg ? 'text-green-400' : 'text-zinc-700'}`}>
                        {activeLeg ? activeLeg.speed.toFixed(1) : '-.-'}
                    </span>
                 </div>
            </div>

            {/* SAFETY STRIP */}
            <div className="flex justify-between items-center mt-2 px-1 pt-2 border-t border-white/5">
                <div className="flex flex-col items-center">
                    <span className="text-[8px] text-cyan-700/80 mb-0.5">CPA RNG</span>
                    <span className={`text-sm font-bold tabular-nums tracking-tighter ${cpa && cpa.range < 1000 ? 'text-red-500 animate-pulse' : cpa ? 'text-cyan-400' : 'text-zinc-700'}`}>
                        {cpa ? cpa.range.toFixed(0) + ' yds' : '---- yds'}
                    </span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-[8px] text-cyan-700/80 mb-0.5">TIME TO CPA</span>
                    <span className={`text-sm font-bold tabular-nums tracking-tighter ${cpa ? 'text-cyan-400' : 'text-zinc-700'}`}>
                        {cpa ? formatTime(cpa.time) : '--:--'}
                    </span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-[8px] text-cyan-700/80 mb-0.5">CPA BRG</span>
                    <span className={`text-sm font-bold tabular-nums tracking-tighter ${cpa ? 'text-cyan-400' : 'text-zinc-700'}`}>
                        {cpa ? cpa.bearing.toFixed(0).padStart(3, '0') : '---'}
                    </span>
                </div>
            </div>
        </div>

        {/* CONTROLS (Only if selected) */}
        {selectedTracker && activeLeg ? (
        <>
            {/* ZONE A: TIMELINE (Scrollable) */}
            <div className="flex-none h-12 flex items-center gap-1 overflow-x-auto px-2 border-b border-white/10 bg-black/20 no-scrollbar">
                {legs.map((leg, idx) => (
                    <button
                        key={idx}
                        onClick={() => setSelectedLegIndex(idx)}
                        className={`flex items-center justify-center h-8 px-3 min-w-[60px] skew-x-[-10deg] border border-white/10 transition-colors
                            ${idx === selectedLegIndex
                                ? 'bg-green-900/40 text-green-400 border-green-500/30'
                                : 'bg-white/5 text-zinc-500 hover:bg-white/10'}`}
                    >
                        <div className="skew-x-[10deg] text-[10px] font-bold">
                            {idx === 0 ? 'START' : `LEG ${idx}`}
                        </div>
                    </button>
                ))}
                <button
                    onClick={handleMark}
                    className="flex items-center justify-center h-8 px-3 min-w-[30px] skew-x-[-10deg] border border-white/10 bg-white/5 text-zinc-400 hover:bg-green-900/30 hover:text-green-400 transition-colors"
                    title="New Leg"
                >
                    <div className="skew-x-[10deg] font-bold text-lg leading-none">+</div>
                </button>
            </div>

            {/* MAIN CONTROLS AREA (Flex Grow) */}
            <div className="flex-grow flex flex-col p-4 gap-6 overflow-y-auto min-h-0 flex-shrink">

                {/* ZONE B: KINEMATICS (Large Knobs) */}
                <div className="flex justify-around items-start flex-shrink min-h-0">
                    <RotaryKnob
                        label="COURSE"
                        value={activeLeg.course}
                        min={0}
                        max={360}
                        step={1}
                        loop={true}
                        sensitivity={0.5}
                        onChange={(v) => handleUpdateLeg({ course: v })}
                        format={(v) => v.toFixed(0).padStart(3, '0')}
                        unit="DEG"
                        size="large"
                    />
                    <RotaryKnob
                        label="SPEED"
                        value={activeLeg.speed}
                        min={0}
                        max={35}
                        step={0.1}
                        sensitivity={0.1}
                        onChange={(v) => handleUpdateLeg({ speed: v })}
                        format={(v) => v.toFixed(1)}
                        unit="KTS"
                        size="large"
                    />
                </div>

                <div className="h-px bg-white/10 w-full" />

                {/* ZONE C: ANCHOR (Small Knobs) */}
                <div className="flex flex-col gap-2">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest text-center">Anchor Settings</div>
                    <div className="flex justify-around items-start mt-2">
                        <RotaryKnob
                            label="BEARING"
                            value={activeLeg.startBearing}
                            min={0}
                            max={360}
                            step={0.5}
                            loop={true}
                            sensitivity={0.5}
                            onChange={(v) => handleUpdateLeg({ startBearing: v })}
                            format={(v) => v.toFixed(0).padStart(3, '0')}
                            unit="DEG"
                            size="small"
                        />
                        <RotaryKnob
                            label="RANGE"
                            value={activeLeg.startRange}
                            min={100}
                            max={40000}
                            step={100}
                            sensitivity={50} // 50 yds per pixel drag
                            onChange={(v) => handleUpdateLeg({ startRange: v })}
                            format={(v) => (v/1000).toFixed(1)}
                            unit="KYD"
                            size="small"
                        />
                    </div>
                </div>

                <div className="text-[10px] text-zinc-600 text-center">
                    Leg Start: {formatTime(activeLeg.startTime)}
                </div>

            </div>

            {/* ZONE D: TOOLS (Footer) */}
            <div className="flex-none flex-shrink-0 p-3 border-t border-white/10 grid grid-cols-2 gap-2 bg-black/20">
                <button
                    onClick={handleMerge}
                    disabled={selectedLegIndex === 0}
                    className="px-4 py-2 bg-zinc-800 text-zinc-400 text-[10px] font-bold rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    DELETE LEG
                </button>
                <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-red-900/20 text-red-400 text-[10px] font-bold rounded hover:bg-red-900/40 border border-red-900/30"
                >
                    RESET SOL
                </button>
            </div>
        </>
        ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-zinc-600">
                <div className="text-xs">NO TRACKER SELECTED</div>
                <div className="mt-2 text-[10px] opacity-50">Use [ ] or Select Above</div>
            </div>
        )}

    </div>
  );
};

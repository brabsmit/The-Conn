import { useSubmarineStore } from '../../store/useSubmarineStore';
import { calculateProjectedSolution, calculateSolutionCPA } from '../../lib/tma';
import { RotaryKnob } from '../RotaryKnob';
import { useEffect, useState } from 'react';

export const TMAControls = () => {
  const selectedTrackerId = useSubmarineStore((state) => state.selectedTrackerId);
  const trackers = useSubmarineStore((state) => state.trackers);
  const updateTrackerSolution = useSubmarineStore((state) => state.updateTrackerSolution);
  const addSolutionLeg = useSubmarineStore((state) => state.addSolutionLeg);
  const gameTime = useSubmarineStore((state) => state.gameTime);

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

  useEffect(() => {
    if (selectedTracker && selectedTracker.solution.legs) {
        setSelectedLegIndex(selectedTracker.solution.legs.length - 1);
    }
  }, [selectedTracker?.id, selectedTracker?.solution.legs?.length]);

  if (!selectedTracker) {
    return (
        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs bg-white/5 border-l border-white/10">
            NO TRACKER SELECTED
        </div>
    );
  }

  // Ensure legs exist (fallback for old data if any)
  const legs = selectedTracker.solution.legs || [];
  if (legs.length === 0) {
      // Should not happen with new initializers, but handle gracefully
      return <div>Loading Solution...</div>;
  }

  const activeLeg = legs[selectedLegIndex] || legs[legs.length - 1];

  // Handlers
  const handleUpdateLeg = (updates: Partial<typeof activeLeg>) => {
     const newLegs = [...legs];
     newLegs[selectedLegIndex] = { ...activeLeg, ...updates };

     // Send full legs update. The store will auto-sync flat fields if it's the last leg.
     updateTrackerSolution(selectedTracker.id, { legs: newLegs });
  };

  const handleMark = () => {
     // Create a new leg
     addSolutionLeg(selectedTracker.id);
     // Auto-select is handled by useEffect on length change
  };

  const handleReset = () => {
      // Reset to single leg at current time? Or just reset params of current leg?
      // "Reset" usually implies clearing history.
      const resetLeg = {
          startTime: gameTime,
          startRange: 10000,
          startBearing: selectedTracker.currentBearing + heading, // Rough guess
          course: 0,
          speed: 10,
          startOwnShip: ownShip
      };
      updateTrackerSolution(selectedTracker.id, { legs: [resetLeg] });
  };

  const handleMerge = () => {
      // "Merge" usually means collapse previous legs into one if they are linear?
      // Or maybe merge 2 segments.
      // For now, let's make it a "Delete Previous Legs" (collapse to current start)?
      // Or just remove the leg and extend previous.

      if (selectedLegIndex > 0) {
          // Remove this leg
          const newLegs = legs.filter((_, i) => i !== selectedLegIndex);
          updateTrackerSolution(selectedTracker.id, { legs: newLegs });
          setSelectedLegIndex(prev => Math.max(0, prev - 1));
      }
  };

  // Calculate Projection for Display (Top Readout)
  const projected = calculateProjectedSolution(
    selectedTracker.solution as any,
    ownShip,
    gameTime
  );

  // Calculate CPA based on Solution (Not Truth)
  const cpa = calculateSolutionCPA(
      selectedTracker.solution as any,
      ownShipFull,
      gameTime
  );

  const getTrackerLabel = () => {
     if (selectedTracker.classificationStatus === 'PENDING') return `${selectedTrackerId} (PENDING)`;
     if (selectedTracker.classification) {
         const short = selectedTracker.classification === 'MERCHANT' ? '(M)' :
                       selectedTracker.classification === 'ESCORT' ? '(E)' :
                       selectedTracker.classification === 'SUB' ? '(S)' : '(B)';
         return `${selectedTrackerId} ${short}`;
     }
     return selectedTrackerId;
  };

  const formatTime = (t: number) => {
      if (t === undefined) return "--:--";
      const minutes = Math.floor(t / 60);
      const seconds = Math.floor(t % 60);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-white/5 border-l border-white/10 overflow-hidden font-mono select-none">

        {/* HEADER / READOUT */}
        <div className="flex-none p-3 bg-black/40 border-b border-white/10 shadow-inner shadow-black/50">
            <div className="flex justify-between items-center mb-2">
                <div className="text-[10px] text-zinc-400 font-bold tracking-widest">{getTrackerLabel()}</div>
                <div className="text-[10px] text-zinc-600">DOT STACK: {Math.round(gameTime - activeLeg.startTime)}s</div>
            </div>

            <div className="grid grid-cols-4 gap-2">
                 <div className="flex flex-col items-center">
                    <span className="text-[9px] text-zinc-500 mb-0.5">BRG</span>
                    <span className="text-xl text-green-400 font-bold tabular-nums tracking-tighter drop-shadow-[0_0_2px_rgba(74,222,128,0.5)]">
                        {projected.calcBearing.toFixed(0).padStart(3, '0')}
                    </span>
                 </div>
                 <div className="flex flex-col items-center">
                    <span className="text-[9px] text-zinc-500 mb-0.5">RNG</span>
                    <span className="text-xl text-green-400 font-bold tabular-nums tracking-tighter drop-shadow-[0_0_2px_rgba(74,222,128,0.5)]">
                        {(projected.calcRange / 1000).toFixed(1)}k
                    </span>
                 </div>
                 <div className="flex flex-col items-center">
                    <span className="text-[9px] text-zinc-500 mb-0.5">CRS</span>
                    <span className="text-xl text-green-400 font-bold tabular-nums tracking-tighter drop-shadow-[0_0_2px_rgba(74,222,128,0.5)]">
                        {activeLeg.course.toFixed(0).padStart(3, '0')}
                    </span>
                 </div>
                 <div className="flex flex-col items-center">
                    <span className="text-[9px] text-zinc-500 mb-0.5">SPD</span>
                    <span className="text-xl text-green-400 font-bold tabular-nums tracking-tighter drop-shadow-[0_0_2px_rgba(74,222,128,0.5)]">
                        {activeLeg.speed.toFixed(1)}
                    </span>
                 </div>
            </div>

            {/* SAFETY STRIP */}
            <div className="flex justify-between items-center mt-2 px-1 pt-2 border-t border-white/5">
                <div className="flex flex-col items-center">
                    <span className="text-[8px] text-cyan-700/80 mb-0.5">CPA RNG</span>
                    <span className={`text-sm font-bold tabular-nums tracking-tighter ${cpa.range < 1000 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                        {cpa.range.toFixed(0)} yds
                    </span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-[8px] text-cyan-700/80 mb-0.5">TIME TO CPA</span>
                    <span className="text-sm text-cyan-400 font-bold tabular-nums tracking-tighter">
                        {formatTime(cpa.time)}
                    </span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-[8px] text-cyan-700/80 mb-0.5">CPA BRG</span>
                    <span className="text-sm text-cyan-400 font-bold tabular-nums tracking-tighter">
                        {cpa.bearing.toFixed(0).padStart(3, '0')}
                    </span>
                </div>
            </div>
        </div>

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
        <div className="flex-grow flex flex-col p-4 gap-6 overflow-y-auto min-h-0">

            {/* ZONE B: KINEMATICS (Large Knobs) */}
            <div className="flex justify-around items-start">
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
        <div className="flex-none p-3 border-t border-white/10 grid grid-cols-2 gap-2 bg-black/20">
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

    </div>
  );
};

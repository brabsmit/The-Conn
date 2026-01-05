import { useSubmarineStore } from '../../store/useSubmarineStore';
import { calculateProjectedSolution } from '../../lib/tma';

export const TMAControls = () => {
  const selectedTrackerId = useSubmarineStore((state) => state.selectedTrackerId);
  const selectedTrackerSpeed = useSubmarineStore((state) => state.trackers[0]?.solution.speed)
  const selectedTrackerCourse = useSubmarineStore((state) => state.trackers[0]?.solution.course)
  const trackers = useSubmarineStore((state) => state.trackers);
  const updateTrackerSolution = useSubmarineStore((state) => state.updateTrackerSolution);
  const gameTime = useSubmarineStore((state) => state.gameTime);
  // Get current ownship state (atomically to avoid object reference loop)
  const x = useSubmarineStore((state) => state.x);
  const y = useSubmarineStore((state) => state.y);
  const heading = useSubmarineStore((state) => state.heading);
  const ownShip = { x, y, heading };

  const selectedTracker = trackers.find((t) => t.id === selectedTrackerId);

  if (!selectedTracker) {
    return (
        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs bg-white/5 border-l border-white/10">
            NO TRACKER SELECTED
        </div>
    );
  }

  const { speed, range, course, bearing, anchorTime } = selectedTracker.solution;

  // Calculate Projection
  // We cast selectedTracker.solution to any or check type because store types might be lagging in IDE but runtime is fine
  const projected = calculateProjectedSolution(
    selectedTracker.solution as any,
    ownShip,
    gameTime
  );

  const handleMark = () => {
     updateTrackerSolution(selectedTracker.id, {
         anchorTime: gameTime,
         anchorOwnShip: ownShip,
         range: projected.calcRange,
         bearing: projected.calcBearing
         // speed and course remain unchanged
     });
  };

  const formatTime = (t: number) => {
      if (t === undefined) return "--:--";
      const minutes = Math.floor(t / 60);
      const seconds = Math.floor(t % 60);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const sliderClass = "w-full h-4 bg-zinc-900 rounded-none appearance-none cursor-pointer border border-green-900/50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-green-600 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-green-400 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-green-600 [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-green-400";

  return (
    <div className="flex flex-col gap-4 p-4 h-full bg-white/5 border-l border-white/10 overflow-y-auto font-mono">
        {/* Section 1: Readout */}
        <div className="flex flex-col gap-2 p-3 bg-black/40 rounded border border-white/10 shadow-inner shadow-black/50">
            <div className="text-[10px] text-zinc-400 font-bold tracking-widest border-b border-white/5 pb-1 mb-1">{selectedTrackerId}</div>
            <div className="grid grid-cols-2 gap-4">
                 <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500">BEARING</span>
                    <span className="font-mono text-2xl text-green-400 font-bold tabular-nums tracking-tighter drop-shadow-[0_0_2px_rgba(74,222,128,0.5)]">
                        {projected.calcBearing.toFixed(0).padStart(3, '0')}
                    </span>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500">RANGE</span>
                    <span className="font-mono text-2xl text-green-400 font-bold tabular-nums tracking-tighter drop-shadow-[0_0_2px_rgba(74,222,128,0.5)]">
                        {projected.calcRange.toFixed(0)}
                    </span>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500">COURSE</span>
                    <span className="font-mono text-2xl text-green-400 font-bold tabular-nums tracking-tighter drop-shadow-[0_0_2px_rgba(74,222,128,0.5)]">
                        {selectedTrackerCourse.toFixed(0).padStart(3, '0')}
                    </span>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500">SPEED</span>
                    <span className="font-mono text-2xl text-green-400 font-bold tabular-nums tracking-tighter drop-shadow-[0_0_2px_rgba(74,222,128,0.5)]">
                        {selectedTrackerSpeed.toFixed(1)}
                    </span>
                 </div>
            </div>
        </div>

        {/* Section 2: Anchor */}
        <div className="flex flex-col gap-2 p-3 bg-white/5 rounded border border-white/10">
             <div className="flex justify-between items-end">
                 <span className="text-[10px] text-zinc-400">SOLUTION TIME</span>
                 <span className="font-mono text-green-500 text-lg">{formatTime(anchorTime)}</span>
             </div>
             <button
                onClick={handleMark}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-xs font-bold text-white border border-white/20 rounded transition-colors shadow-lg"
             >
                MARK (RESET TO NOW)
             </button>
        </div>

        {/* Section 3: Inputs */}
        <div className="flex flex-col gap-4 mt-2">

            {/* Speed Slider */}
            <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-green-500 font-mono">
                <span>SPEED</span>
                <span>{speed.toFixed(1)} kts</span>
                </div>
                <input
                type="range"
                min="0"
                max="35"
                step="0.1"
                value={speed}
                onChange={(e) => updateTrackerSolution(selectedTracker.id, { speed: parseFloat(e.target.value) })}
                className={sliderClass}
                />
            </div>

            {/* Course Slider */}
            <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-green-500 font-mono">
                <span>COURSE</span>
                <span>{course.toFixed(0).padStart(3, '0')}°</span>
                </div>
                <input
                type="range"
                min="0"
                max="359"
                step="1"
                value={course}
                onChange={(e) => updateTrackerSolution(selectedTracker.id, { course: parseFloat(e.target.value) })}
                className={sliderClass}
                />
            </div>

            {/* Range Slider */}
            <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-green-500 font-mono">
                <span>RANGE (ANCHOR)</span>
                <span>{range.toFixed(0)} yds</span>
                </div>
                <input
                type="range"
                min="0"
                max="10000"
                step="100"
                value={range}
                onChange={(e) => updateTrackerSolution(selectedTracker.id, { range: parseFloat(e.target.value) })}
                className={sliderClass}
                />
            </div>

            {/* Bearing Slider */}
            <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-green-500 font-mono">
                <span>BRG</span>
                <span>{bearing.toFixed(0).padStart(3, '0')}°</span>
                </div>
                <input
                type="range"
                min="0"
                max="359"
                step="1"
                value={bearing}
                onChange={(e) => updateTrackerSolution(selectedTracker.id, { bearing: parseFloat(e.target.value) })}
                className={sliderClass}
                />
            </div>
        </div>
    </div>
  );
};

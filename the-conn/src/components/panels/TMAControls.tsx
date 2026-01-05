import { useSubmarineStore } from '../../store/useSubmarineStore';

export const TMAControls = () => {
  const selectedTrackerId = useSubmarineStore((state) => state.selectedTrackerId);
  const trackers = useSubmarineStore((state) => state.trackers);
  const updateTrackerSolution = useSubmarineStore((state) => state.updateTrackerSolution);

  const selectedTracker = trackers.find((t) => t.id === selectedTrackerId);

  if (!selectedTracker) {
    return (
        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
            NO TRACKER SELECTED
        </div>
    );
  }

  const { speed, range, course } = selectedTracker.solution;

  return (
    <div className="flex flex-col gap-2 p-4 h-full justify-center">

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
          className="w-full h-4 bg-zinc-900 rounded-none appearance-none cursor-pointer border border-green-900/50
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-green-600 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-green-400
                     [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-green-600 [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-green-400"
        />
      </div>

      {/* Range Slider */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-green-500 font-mono">
          <span>RANGE</span>
          <span>{range.toFixed(0)} yds</span>
        </div>
        <input
          type="range"
          min="1000"
          max="40000"
          step="100"
          value={range}
          onChange={(e) => updateTrackerSolution(selectedTracker.id, { range: parseFloat(e.target.value) })}
          className="w-full h-4 bg-zinc-900 rounded-none appearance-none cursor-pointer border border-green-900/50
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-green-600 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-green-400
                     [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-green-600 [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-green-400"
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
          className="w-full h-4 bg-zinc-900 rounded-none appearance-none cursor-pointer border border-green-900/50
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-green-600 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-green-400
                     [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-green-600 [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-green-400"
        />
      </div>

    </div>
  );
};

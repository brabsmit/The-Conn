import { useEffect, useRef, useState } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { useResize } from '../../hooks/useResize';
import { useInterval } from '../../hooks/useInterval';
import { sonarEngine } from '../../services/SonarEngine';

const SonarBezel = ({ width }: { width: number }) => {
    // Throttled visual state (1Hz)
    const [visibleTrackers, setVisibleTrackers] = useState(() => useSubmarineStore.getState().trackers);

    useInterval(() => {
        setVisibleTrackers(useSubmarineStore.getState().trackers);
    }, 1000);

    return (
        <div className="absolute top-[-20px] left-0 pointer-events-none z-10" style={{ width: width, height: '100%' }}>
            {visibleTrackers.map((tracker) => {
                 let signedBearing = tracker.currentBearing;
                 if (signedBearing > 180) signedBearing -= 360;

                 // Check visibility within the +/- 150 degree window
                 if (signedBearing < -150 || signedBearing > 150) return null;

                 const x = ((signedBearing + 150) / 300) * width;

                 return (
                     <div
                        key={tracker.id}
                        className="absolute top-0 flex flex-col items-center"
                        style={{ left: x, transform: 'translateX(-50%)' }}
                     >
                        {/* Triangle pointing DOWN */}
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-[#33ff33]" />

                        {/* Tracker ID */}
                        <div className="text-[#33ff33] font-mono font-bold text-sm mt-0 shadow-black drop-shadow-md">
                            {tracker.id}
                        </div>
                     </div>
                 );
            })}
        </div>
    );
};

const SonarDisplay = () => {
    const { ref, width: rawWidth, height: rawHeight } = useResize();
    const width = Math.floor(rawWidth);
    const height = Math.floor(rawHeight);

    const [showSolution, setShowSolution] = useState(true);
    const viewScale = useSubmarineStore(state => state.viewScale);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize Engine
    useEffect(() => {
        if (width > 0 && height > 0) {
            sonarEngine.initialize(width, height);
        }
    }, [width, height]);

    // Attach View
    useEffect(() => {
        const container = containerRef.current;
        if (container && width > 0 && height > 0) {
            try {
                const canvas = sonarEngine.getView();
                // Ensure canvas is not already attached elsewhere (though singleton handles this conceptually, DOM wise we need to move it)
                if (canvas.parentElement !== container) {
                    container.appendChild(canvas);
                }
            } catch (e) {
                // Engine might not be ready yet if width/height 0
            }
        }

        return () => {
            if (container) {
                const canvas = container.querySelector('canvas');
                if (canvas) {
                    container.removeChild(canvas);
                }
            }
        };
    }, [width, height]); // Re-attach if dimensions change (engine handles resize, but we need to ensure it's in the DOM)

    // Sync Props
    useEffect(() => {
        sonarEngine.setViewScale(viewScale);
    }, [viewScale]);

    useEffect(() => {
        sonarEngine.setShowSolution(showSolution);
    }, [showSolution]);

    return (
        <div ref={ref} className="relative flex justify-center items-center w-full h-full bg-black">
            {width > 0 && height > 0 && (
                <div className="relative w-full h-full">
                    {/* The Engine View Container */}
                    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#001100]" />

                    <SonarBezel width={width} />
                </div>
            )}

            {/* UI Overlay */}
            <div className="absolute top-2 right-2 flex gap-2">
                <button
                    className={`px-2 py-1 text-xs font-mono border rounded ${showSolution ? 'bg-green-900/50 text-green-400 border-green-600' : 'bg-gray-900/50 text-gray-500 border-gray-700'}`}
                    onClick={() => setShowSolution(!showSolution)}
                >
                    SOL
                </button>
            </div>
        </div>
    );
};

export default SonarDisplay;

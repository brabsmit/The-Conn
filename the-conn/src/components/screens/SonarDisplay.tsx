import React, { useEffect, useRef, useState } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { useResize } from '../../hooks/useResize';
import { useInterval } from '../../hooks/useInterval';
import { SonarEngine } from '../../services/SonarEngine';
import SonarOverlay from './SonarOverlay';

const SonarBezel = ({ width }: { width: number }) => {
    // Throttled visual state (1Hz)
    const [visibleTrackers, setVisibleTrackers] = useState(() => useSubmarineStore.getState().trackers);

    useInterval(() => {
        setVisibleTrackers(useSubmarineStore.getState().trackers);
    }, 1000);

    return (
        <div className="absolute top-[-20px] left-0 pointer-events-none z-10" style={{ width: width, height: '100%' }} data-testid="sonar-bezel">
            {visibleTrackers.map((tracker) => {
                 // Helper for Viewport Mapping (300 deg)
                 const relBearing = (tracker.currentBearing % 360 + 360) % 360; // Normalize 0-360

                 // Baffles: 150 < rb < 210
                 if (relBearing > 150 && relBearing < 210) return null;

                 let viewAngle = 0;
                 if (relBearing >= 210) {
                     viewAngle = relBearing - 210; // 210..360 -> 0..150
                 } else {
                     viewAngle = relBearing + 150; // 0..150 -> 150..300
                 }

                 const x = (viewAngle / 300) * width;

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

// Task 94.1: The "Zombie" Component - Decoupled rendering
const SonarComponent = () => {
    const { ref, width: rawWidth, height: rawHeight } = useResize();
    const width = Math.floor(rawWidth);
    const height = Math.floor(rawHeight);

    const [showSolution, setShowSolution] = useState(true);
    // REMOVED: useSubmarineStore subscription for viewScale

    // Task 94.3: Ref Persistence Safety Net
    const engineRef = useRef<SonarEngine | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize Engine (Run Once)
    useEffect(() => {
        if (!engineRef.current) {
            engineRef.current = new SonarEngine();
        }
        // No cleanup that destroys the engine
    }, []);

    // Initialize/Resize Engine when dimensions change
    useEffect(() => {
        if (engineRef.current && width > 0 && height > 0) {
            engineRef.current.initialize(width, height);
        }
    }, [width, height]);

    // Attach View
    useEffect(() => {
        const container = containerRef.current;
        const engine = engineRef.current;

        if (container && engine && width > 0 && height > 0) {
            try {
                const canvas = engine.getView();
                // Ensure canvas is not already attached elsewhere
                if (canvas.parentElement !== container) {
                    container.appendChild(canvas);
                }
            } catch (e) {
                // Engine might not be ready yet
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
    }, [width, height]); // Re-attach if dimensions change

    // Sync Local State (ShowSolution)
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.setShowSolution(showSolution);
        }
    }, [showSolution]);

    return (
        <div ref={ref} className="relative flex justify-center items-center w-full h-full bg-black">
            {width > 0 && height > 0 && (
                <div className="relative w-full h-full">
                    {/* The Engine View Container */}
                    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#001100]" />

                    <SonarBezel width={width} />

                    {/* New Independent Overlay Layer */}
                    <SonarOverlay width={width} height={height} />
                </div>
            )}

            {/* UI Overlay */}
            <div className="absolute top-2 right-2 flex gap-2 z-30">
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

// Task 94.1: Strict Memo
export const SonarDisplay = React.memo(SonarComponent, (prev, next) => {
    // Only re-render if props change (which there are none currently) or if internal state changes.
    // React.memo only compares props. Since SonarComponent has no props, this comparison function
    // effectively makes it never re-render due to parent updates.
    // BUT the component uses hooks (useResize, useState). Those will still trigger re-renders.
    // The requirement says: "ONLY re-render if the physical pixel size changes".
    // Since useResize is inside the component, it triggers the re-render.
    // However, React.memo wraps the component export. The props are empty.
    // So if the parent re-renders, this component won't re-render unless we return false.
    // Since there are no props, we can return true always? No, if we return true, it skips re-render.
    // The requirement implies we should ignore parent renders.
    return true;
});

export default SonarDisplay;

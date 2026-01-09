import React, { useState } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { useInterval } from '../../hooks/useInterval';

interface SonarBezelProps {
    width: number;
    height: number;
}

const SonarBezel: React.FC<SonarBezelProps> = ({ width }) => {
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

export default SonarBezel;

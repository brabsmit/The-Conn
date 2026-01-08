import React, { useCallback } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { normalizeAngle } from '../../lib/tma';

interface SonarOverlayProps {
    width: number;
    height: number;
}

const SonarOverlay: React.FC<SonarOverlayProps> = ({ width, height }) => {
    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (width === 0) return;

        // Get click position relative to the element
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;

        // Inverse Mapping: ScreenX -> ViewAngle -> RelativeBearing
        // ScreenX = (viewAngle / 300) * CanvasWidth
        // viewAngle = (ScreenX / CanvasWidth) * 300
        const viewAngle = (x / width) * 300;

        let relBearing = 0;

        // Logic matched with SonarEngine.ts mapping
        // 0px (Left) -> ViewAngle 0 -> RelBearing 210
        // Width/2 (Center) -> ViewAngle 150 -> RelBearing 360/0
        // Width (Right) -> ViewAngle 300 -> RelBearing 150

        if (viewAngle <= 150) {
            relBearing = viewAngle + 210;
        } else {
            relBearing = viewAngle - 150;
        }

        relBearing = normalizeAngle(relBearing);

        // Fire and forget to store - avoiding direct subscription in this component
        useSubmarineStore.getState().designateTracker(relBearing);
    }, [width]);

    return (
        <div
            className="absolute top-0 left-0 cursor-crosshair z-20"
            onClick={handleClick}
            style={{ width: width, height: height }}
            data-testid="sonar-overlay"
        />
    );
};

export default React.memo(SonarOverlay);

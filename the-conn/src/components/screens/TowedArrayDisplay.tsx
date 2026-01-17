import React, { useRef, useEffect, useState } from 'react';
import { SonarEngine } from '../../services/SonarEngine';
import { useResize } from '../../hooks/useResize';
import { useSubmarineStore } from '../../store/useSubmarineStore';

const TowedArrayDisplay: React.FC = () => {
    const { ref: containerRef, width: rawWidth, height: rawHeight } = useResize();

    // Lock dimensions after initial valid measurement
    const [lockedSize, setLockedSize] = useState<{ width: number, height: number } | null>(null);

    useEffect(() => {
        if (!lockedSize && rawWidth > 0 && rawHeight > 0) {
            setLockedSize({
                width: Math.floor(rawWidth),
                height: Math.floor(rawHeight)
            });
        }
    }, [rawWidth, rawHeight, lockedSize]);

    const width = lockedSize ? lockedSize.width : Math.floor(rawWidth);
    const height = lockedSize ? lockedSize.height : Math.floor(rawHeight);

    // Layer 0: WebGL Container
    const webglContainerRef = useRef<HTMLDivElement>(null);

    // Layer 1: 2D Overlay Canvas
    const overlayRef = useRef<HTMLCanvasElement>(null);

    // Engine Instance (will be separate from hull array)
    const engineRef = useRef<SonarEngine | null>(null);

    // Initial Setup
    useEffect(() => {
        if (!webglContainerRef.current || !overlayRef.current || width === 0 || height === 0) return;

        // Initialize towed array engine if needed
        if (!engineRef.current) {
            // TODO: Create dedicated TowedArrayEngine with linear geometry
            engineRef.current = new SonarEngine(webglContainerRef.current, overlayRef.current, width, height);
        }
    }, [width, height]);

    // Handle Resize
    useEffect(() => {
        if (engineRef.current && width > 0 && height > 0) {
            engineRef.current.resize(width, height);
        }
    }, [width, height]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (engineRef.current) {
                engineRef.current.destroy();
                engineRef.current = null;
            }
        };
    }, []);

    const containerStyle: React.CSSProperties = lockedSize ? {
        width: `${width}px`,
        height: `${height}px`,
        flexGrow: 0,
        flexShrink: 1,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'black'
    } : {
        flexGrow: 1,
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'black'
    };

    return (
        <div
            className="w-full h-full relative bg-black min-h-0 flex flex-col"
            data-testid="towed-array-display"
        >
            <div
                ref={containerRef}
                className="select-none"
                style={containerStyle}
            >
                {/* Layer 0: WebGL Waterfall */}
                <div ref={webglContainerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />

                {/* Layer 1: 2D Overlay */}
                <canvas
                    ref={overlayRef}
                    width={width}
                    height={height}
                    style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, pointerEvents: 'none' }}
                />

                {/* Status Indicator */}
                <div className="absolute top-2 left-2 z-50 pointer-events-none">
                    <div className="px-2 py-1 text-[10px] font-mono font-bold bg-black/50 border border-green-700/50 text-green-400 rounded">
                        TB-29 DEPLOYED
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TowedArrayDisplay;

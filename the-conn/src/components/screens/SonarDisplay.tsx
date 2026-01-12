import React, { useRef, useEffect, useState } from 'react';
import { SonarEngine } from '../../services/SonarEngine';
import SonarOverlay from './SonarOverlay';
import SonarBezel from '../panels/SonarBezel';
import { useResize } from '../../hooks/useResize';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { useSonarAudio } from '../../hooks/useSonarAudio';

const SonarDisplay: React.FC = () => {
    const activeIntercepts = useSubmarineStore(state => state.activeIntercepts);
    const { playPing } = useSonarAudio();

    // We now use a flex container for correct sizing, but we need refs for the layers
    const { ref: containerRef, width: rawWidth, height: rawHeight } = useResize();

    // Task 99.1: Layout Isolation
    // Lock dimensions after initial valid measurement to prevent flex-induced resizing/clearing
    const [lockedSize, setLockedSize] = useState<{ width: number, height: number } | null>(null);

    // Task 101.2: Solution Overlay State
    const [showSolutions, setShowSolutions] = useState<boolean>(false);

    useEffect(() => {
        // Only lock if we haven't yet, and we have valid dimensions
        if (!lockedSize && rawWidth > 0 && rawHeight > 0) {
            // Round to ensure pixel-perfect alignment
            setLockedSize({
                width: Math.floor(rawWidth),
                height: Math.floor(rawHeight)
            });
        }
    }, [rawWidth, rawHeight, lockedSize]);

    // Use locked dimensions if available, otherwise raw
    const width = lockedSize ? lockedSize.width : Math.floor(rawWidth);
    const height = lockedSize ? lockedSize.height : Math.floor(rawHeight);

    // Audio / Visual Warning Logic
    const [showInterceptWarning, setShowInterceptWarning] = useState(false);
    const lastInterceptTimeRef = useRef<number>(0);
    const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (activeIntercepts.length > 0) {
            // Get the latest intercept
            const latest = activeIntercepts[activeIntercepts.length - 1];

            // Only act if this is a NEW intercept (time > last processed)
            if (latest.timestamp > lastInterceptTimeRef.current) {
                lastInterceptTimeRef.current = latest.timestamp;

                // Trigger Audio ONCE per new intercept
                playPing(0.8);

                // Trigger Visual Warning
                setShowInterceptWarning(true);

                // Clear existing timer to extend duration if rapid pings occur
                if (warningTimerRef.current) {
                    clearTimeout(warningTimerRef.current);
                }

                warningTimerRef.current = setTimeout(() => {
                    setShowInterceptWarning(false);
                    warningTimerRef.current = null;
                }, 2000);
            }
        }
    }, [activeIntercepts, playPing]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        };
    }, []);

    // Layer 0: WebGL Container
    const webglContainerRef = useRef<HTMLDivElement>(null);

    // Layer 1: 2D Overlay Canvas
    const overlayRef = useRef<HTMLCanvasElement>(null);

    // Engine Instance
    const engineRef = useRef<SonarEngine | null>(null);

    // Initial Setup
    useEffect(() => {
        // Ensure dimensions are valid and refs exist
        if (!webglContainerRef.current || !overlayRef.current || width === 0 || height === 0) return;

        // Initialize engine if needed
        if (!engineRef.current) {
             engineRef.current = new SonarEngine(webglContainerRef.current, overlayRef.current, width, height);
        }
    }, [width, height]);

    // Handle Resize / View Update
    useEffect(() => {
        if (engineRef.current && width > 0 && height > 0) {
            engineRef.current.resize(width, height);
        }
    }, [width, height]);

    // Sync Show Solutions
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.setShowSolutions(showSolutions);
        }
    }, [showSolutions]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (engineRef.current) {
                engineRef.current.destroy();
                engineRef.current = null;
            }
        };
    }, []);

    // Task 99.1: Apply rigid styling once locked
    const containerStyle: React.CSSProperties = lockedSize ? {
        width: `${width}px`,
        height: `${height}px`,
        flexGrow: 0,
        flexShrink: 0,
        minHeight: `${height}px`, // Enforce minimum
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
            className="w-full h-full relative border-t-2 border-gray-800 bg-black min-h-0 flex flex-col"
            data-testid="sonar-display"
        >
            {/* Main Container for Resize Observer */}
            <div
                ref={containerRef}
                className="select-none"
                style={containerStyle}
            >
                {/* Layer 0: The WebGL Waterfall */}
                <div ref={webglContainerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />

                {/* Layer 1: The 2D Overlay */}
                <canvas
                    ref={overlayRef}
                    width={width}
                    height={height}
                    style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, pointerEvents: 'none' }}
                />

                {/* High Frequency Intercept Warning Overlay */}
                {showInterceptWarning && (
                    <div className="absolute top-10 left-0 w-full flex justify-center pointer-events-none z-50">
                        <div className="bg-red-900/80 border-2 border-red-500 text-red-100 px-6 py-2 rounded shadow-lg animate-pulse font-mono font-bold text-xl tracking-widest">
                            HIGH FREQUENCY INTERCEPT
                        </div>
                    </div>
                )}

                {/* Interaction Layer (Click Handling) - Z-Index needs to be above overlays */}
                <SonarOverlay width={width} height={height} />

                {/* Task 101.2: [SOL] Toggle Button */}
                <div className="absolute top-4 right-4 z-50 pointer-events-auto">
                    <button
                        onClick={() => setShowSolutions(!showSolutions)}
                        className={`px-2 py-1 text-xs font-mono font-bold border border-current rounded
                            ${showSolutions ? 'text-green-400 border-green-400 bg-green-900/50' : 'text-gray-500 border-gray-600 bg-black/50'}`}
                    >
                        [SOL]
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SonarDisplay;

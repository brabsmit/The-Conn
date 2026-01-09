import React, { useRef, useEffect } from 'react';
import { SonarEngine } from '../../services/SonarEngine';
import SonarOverlay from './SonarOverlay';
import SonarBezel from '../panels/SonarBezel';
import { useResize } from '../../hooks/useResize';

const SonarDisplay: React.FC = () => {
    // We now use a flex container for correct sizing, but we need refs for the layers
    const { ref: containerRef, width, height } = useResize();

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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (engineRef.current) {
                engineRef.current.destroy();
                engineRef.current = null;
            }
        };
    }, []);

    // Ensure we handle the "initial" 0 height elegantly in styling if needed,
    // though Playwright is catching it at 0.
    // The flex-grow should enforce size.

    return (
        <div className="w-full h-full relative border-t-2 border-gray-800 bg-black min-h-0 flex flex-col">
            {/* Main Container for Resize Observer */}
            {/* Added flex-grow to this container too to ensure it pushes out */}
            <div ref={containerRef} className="flex-grow w-full h-full relative overflow-hidden bg-black select-none">

                {/* Layer 0: The WebGL Waterfall */}
                <div ref={webglContainerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />

                {/* Layer 1: The 2D Overlay */}
                <canvas
                    ref={overlayRef}
                    width={width}
                    height={height}
                    style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, pointerEvents: 'none' }}
                />

                {/* Interaction Layer (Click Handling) - Z-Index needs to be above overlays */}
                <SonarOverlay width={width} height={height} />

                {/* UI Bezel (Compass, Indicators) - Topmost Visual */}
                <SonarBezel width={width} height={height} />
            </div>
        </div>
    );
};

export default SonarDisplay;

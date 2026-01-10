import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Container, Graphics, Text, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { calculateTargetPosition, normalizeAngle, getShortestAngle } from '../../lib/tma';
import { useResize } from '../../hooks/useResize';

type ViewMode = 'GEO' | 'DOTS';

interface DisplayProps {
    width: number;
    height: number;
    viewMode: ViewMode;
}

const getPixelsPerSecond = (viewScale: string) => {
    // FAST: 1s/pixel -> 1.0 px/s
    // MED:  5s/pixel -> 0.2 px/s
    // SLOW: 20s/pixel -> 0.05 px/s
    if (viewScale === 'MED') return 0.2;
    if (viewScale === 'SLOW') return 0.05;
    return 1.0;
};

const DotStack = ({ width, height, viewMode }: DisplayProps) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);

    useTick(() => {
        const graphics = graphicsRef.current;
        if (!graphics) return;

        graphics.clear();
        const { trackers: allTrackers, contacts, gameTime, ownShipHistory, heading: currentHeading, selectedTrackerId, viewScale } = useSubmarineStore.getState();

        const trackers = allTrackers.filter(t => {
            const c = contacts.find(c => c.id === t.contactId);
            return !c || c.status !== 'DESTROYED';
        });

        const PIXELS_PER_SECOND = getPixelsPerSecond(viewScale);

        const selectedTracker = trackers.find(t => t.id === selectedTrackerId);

        // Sort trackers: unselected first, selected last (so it draws on top)
        const sortedTrackers = [...trackers].sort((a, b) => {
            if (a.id === selectedTrackerId) return 1;
            if (b.id === selectedTrackerId) return -1;
            return 0;
        });

        if (viewMode === 'GEO') {
            const PIXELS_PER_DEGREE = width / 360;
            const SCREEN_CENTER = width / 2;

            // Draw Ownship Heading Trace
            // Color: Blue (0x3333ff)
            graphics.lineStyle(2, 0x3333ff, 0.6);
            let lastX: number | null = null;

            // Reverse iteration: Newest (time ~ gameTime) -> Oldest
            for (let i = ownShipHistory.length - 1; i >= 0; i--) {
                const history = ownShipHistory[i];
                const age = gameTime - history.time;
                const y = age * PIXELS_PER_SECOND;

                // Optimization: Stop drawing if off-screen
                if (y > height + 100) break;

                // Course-Up Logic:
                const angleDiff = getShortestAngle(history.heading, currentHeading);
                const x = SCREEN_CENTER + (angleDiff * PIXELS_PER_DEGREE);

                if (lastX === null) {
                    graphics.moveTo(x, y);
                } else {
                    if (Math.abs(x - lastX) > width / 3) {
                         graphics.moveTo(x, y);
                    } else {
                         graphics.lineTo(x, y);
                    }
                }
                lastX = x;
            }

            // Iterate over all sorted trackers
            sortedTrackers.forEach(tracker => {
                const isSelected = tracker.id === selectedTrackerId;

                // 1. Draw Sensor History (Dots)
                // Set style based on selection
                if (isSelected) {
                    graphics.lineStyle(0);
                    graphics.beginFill(0x33ff33, 1.0); // Bright Green
                } else {
                    graphics.lineStyle(0);
                    graphics.beginFill(0x33ff33, 0.3); // Dim Green
                }

                // Reverse Iteration
                let osIndex = ownShipHistory.length - 1;
                let lastDrawX = -999;
                let lastDrawY = -999;

                for (let i = tracker.bearingHistory.length - 1; i >= 0; i--) {
                    const history = tracker.bearingHistory[i];
                    const age = gameTime - history.time;
                    const y = age * PIXELS_PER_SECOND;

                    if (y > height + 100) break;

                    // Synchronized lookup
                    while (osIndex >= 0 && ownShipHistory[osIndex].time > history.time + 0.1) {
                        osIndex--;
                    }
                    if (osIndex < 0) break;

                    if (Math.abs(ownShipHistory[osIndex].time - history.time) < 0.1) {
                        const ownShipState = ownShipHistory[osIndex];
                        const trueBearingAtTime = normalizeAngle(history.bearing + ownShipState.heading);
                        const angleDiff = getShortestAngle(trueBearingAtTime, currentHeading);

                        if (angleDiff >= -180 && angleDiff <= 180) {
                             const x = SCREEN_CENTER + (angleDiff * PIXELS_PER_DEGREE);

                             // OPTIMIZATION: Visual Delta Check
                             if (Math.abs(x - lastDrawX) + Math.abs(y - lastDrawY) > 2) {
                                graphics.drawCircle(x, y, 2.5);
                                lastDrawX = x;
                                lastDrawY = y;
                             }
                        }
                    }
                }
                graphics.endFill();

                // 2. Draw Solution Line (First, so dots are on top)
                if (tracker.solution) {
                     const solution = tracker.solution;

                     if (isSelected) {
                         // Selected: Bold Orange
                         graphics.lineStyle(3, 0xFFA500, 1.0);
                     } else {
                         // Unselected: Thin White
                         graphics.lineStyle(3, 0xffffff, 0.4);
                     }

                     // 1. Current Point
                     const currentOwnShip = {
                         x: useSubmarineStore.getState().x,
                         y: useSubmarineStore.getState().y,
                         heading: currentHeading
                     };

                     const targetPosNow = calculateTargetPosition(solution, gameTime);
                     const dxNow = targetPosNow.x - currentOwnShip.x;
                     const dyNow = targetPosNow.y - currentOwnShip.y;
                     let trueBearingNow = Math.atan2(dxNow, dyNow) * (180 / Math.PI);
                     trueBearingNow = normalizeAngle(trueBearingNow);

                     const angleDiffNow = getShortestAngle(trueBearingNow, currentHeading);
                     const xNow = SCREEN_CENTER + (angleDiffNow * PIXELS_PER_DEGREE);

                     graphics.moveTo(xNow, 0);
                     let lastX = xNow;

                     // 2. History Points (Reverse Iteration)
                     let osIndex = ownShipHistory.length - 1;
                     for (let i = tracker.bearingHistory.length - 1; i >= 0; i--) {
                        const h = tracker.bearingHistory[i];
                        const age = gameTime - h.time;
                        const y = age * PIXELS_PER_SECOND;

                        if (y > height + 100) break;

                        // Synchronized lookup (zipper)
                        while (osIndex >= 0 && ownShipHistory[osIndex].time > h.time + 0.1) {
                            osIndex--;
                        }
                        if (osIndex < 0) break; // No more ownship history matching

                        const ownShipState = ownShipHistory[osIndex];
                        if (Math.abs(ownShipState.time - h.time) < 0.1) {
                            const targetPos = calculateTargetPosition(solution, h.time);
                            const dx = targetPos.x - ownShipState.x;
                            const dy = targetPos.y - ownShipState.y;

                            let trueBearing = Math.atan2(dx, dy) * (180 / Math.PI);
                            trueBearing = normalizeAngle(trueBearing);

                            const angleDiff = getShortestAngle(trueBearing, currentHeading);
                            const x = SCREEN_CENTER + (angleDiff * PIXELS_PER_DEGREE);

                             if (Math.abs(x - lastX) > width / 3) {
                                 graphics.moveTo(x, y);
                             } else {
                                 graphics.lineTo(x, y);
                             }
                             lastX = x;
                        }
                     }
                }
            });

        } else {
            // DOTS Mode (Residuals)
            // FOCUS MODE: Only render the selected tracker
            const RANGE_DEGREES = 20; // +/- 10
            const PIXELS_PER_DEGREE = width / RANGE_DEGREES;
            const SCREEN_CENTER = width / 2;

            // Draw Center Line (Solution)
            graphics.lineStyle(2, 0xffffff, 0.5);
            graphics.moveTo(SCREEN_CENTER, 0);
            graphics.lineTo(SCREEN_CENTER, height);

            if (selectedTracker && selectedTracker.solution) {
                 graphics.lineStyle(0);
                 graphics.beginFill(0x33ff33, 1.0); // Bright Green

                 // Reverse Iteration
                 let osIndex = ownShipHistory.length - 1;
                 let lastDrawX = -999;
                 let lastDrawY = -999;

                 for (let i = selectedTracker.bearingHistory.length - 1; i >= 0; i--) {
                    const history = selectedTracker.bearingHistory[i];
                    const age = gameTime - history.time;
                    const y = age * PIXELS_PER_SECOND;

                    if (y > height + 100) break;

                    // Synchronized lookup
                    while (osIndex >= 0 && ownShipHistory[osIndex].time > history.time + 0.1) {
                        osIndex--;
                    }
                    if (osIndex < 0) break;

                    if (Math.abs(ownShipHistory[osIndex].time - history.time) < 0.1) {
                        const ownShipState = ownShipHistory[osIndex];

                         // Sensor True Bearing (of THIS tracker)
                        const sensorTrueBearing = normalizeAngle(history.bearing + ownShipState.heading);

                        // Solution True Bearing (of SELECTED solution)
                        const targetPos = calculateTargetPosition(selectedTracker.solution!, history.time);
                        const dx = targetPos.x - ownShipState.x;
                        const dy = targetPos.y - ownShipState.y;
                        let solutionTrueBearing = Math.atan2(dx, dy) * (180 / Math.PI);
                        solutionTrueBearing = normalizeAngle(solutionTrueBearing);

                        // Residual
                        const residual = getShortestAngle(sensorTrueBearing, solutionTrueBearing);

                         const x = SCREEN_CENTER + (residual * PIXELS_PER_DEGREE);

                         // Clip to screen width to avoid drawing outside if error is huge
                         if (x >= 0 && x <= width) {
                             // OPTIMIZATION: Visual Delta Check
                             if (Math.abs(x - lastDrawX) + Math.abs(y - lastDrawY) > 2) {
                                 graphics.drawCircle(x, y, 2.5);
                                 lastDrawX = x;
                                 lastDrawY = y;
                             }
                         }
                    }
                 }
                 graphics.endFill();
            }
        }
    });

    return <Graphics ref={graphicsRef} />;
};

interface KnuckleControlProps {
    width: number;
    height: number;
    viewMode: ViewMode;
    containerRef: React.RefObject<HTMLDivElement>;
}

const KnuckleControl = ({ width, height, viewMode, containerRef }: KnuckleControlProps) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);
    const textRef = useRef<PIXI.Text | null>(null);
    const draggingRef = useRef(false);

    // Store reference to latest state to use in event callbacks without re-binding
    const stateRef = useRef({
        selectedTrackerId: null as string | null,
        activeLegIndex: -1,
        prevLegStartTime: 0,
        gameTime: 0,
        pps: 1.0
    });

    useTick(() => {
        const g = graphicsRef.current;
        const text = textRef.current;
        if (!g || !text) return;

        const store = useSubmarineStore.getState();
        const { gameTime, viewScale, selectedTrackerId, trackers } = store;

        // Update ref for event handlers
        const pps = getPixelsPerSecond(viewScale);
        stateRef.current.gameTime = gameTime;
        stateRef.current.pps = pps;
        stateRef.current.selectedTrackerId = selectedTrackerId;

        if (viewMode !== 'DOTS' || !selectedTrackerId) {
             g.clear();
             text.visible = false;
             g.visible = false;
             return;
        }

        const tracker = trackers.find(t => t.id === selectedTrackerId);
        if (!tracker || !tracker.solution.legs || tracker.solution.legs.length < 2) {
             g.clear();
             text.visible = false;
             g.visible = false;
             return;
        }

        g.visible = true;

        // Get Active Leg (Last one)
        const legs = tracker.solution.legs;
        const activeLegIndex = legs.length - 1;
        const activeLeg = legs[activeLegIndex];
        const prevLeg = legs[activeLegIndex - 1];

        stateRef.current.activeLegIndex = activeLegIndex;
        stateRef.current.prevLegStartTime = prevLeg.startTime;

        const age = gameTime - activeLeg.startTime;
        const y = age * pps;

        // Draw
        g.clear();

        // Hit Area (Transparent but interactive)
        g.beginFill(0xffffff, 0.001); // Almost invisible
        g.drawRect(0, y - 15, width, 30);
        g.endFill();

        // Visible Line
        g.lineStyle(2, 0xffffff, 1.0);
        // Dashed line
        const dashLen = 10;
        const gapLen = 10;
        for (let x = 0; x < width; x += (dashLen + gapLen)) {
            g.moveTo(x, y);
            g.lineTo(Math.min(x + dashLen, width), y);
        }

        // Update Text
        text.x = width - 10;
        text.y = y - 20;
        text.text = `LEG ${activeLegIndex + 1} START`; // Leg 2 is index 1
        text.visible = true;
    });

    const handlePointerDown = () => {
        draggingRef.current = true;
        // Global listeners
        window.addEventListener('mousemove', handleWindowMove);
        window.addEventListener('mouseup', handleWindowUp);
        // Set cursor on body
        document.body.style.cursor = 'row-resize';
    };

    const handleWindowMove = useCallback((e: MouseEvent) => {
        if (!draggingRef.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        // Mouse Y relative to Canvas Top
        const mouseY = e.clientY - rect.top;

        // Calculate Time
        // y = (gameTime - startTime) * pps
        // y / pps = gameTime - startTime
        // startTime = gameTime - (y / pps)

        const { gameTime, pps, selectedTrackerId, prevLegStartTime, activeLegIndex } = stateRef.current;

        if (!selectedTrackerId) return;

        let newStartTime = gameTime - (mouseY / pps);

        // Clamp
        // Max: gameTime (cannot start in future)
        if (newStartTime > gameTime) newStartTime = gameTime;
        // Min: prevLegStartTime + 1 (cannot start before previous leg)
        if (newStartTime <= prevLegStartTime) newStartTime = prevLegStartTime + 0.1;

        // Dispatch Update
        const store = useSubmarineStore.getState();
        const tracker = store.trackers.find(t => t.id === selectedTrackerId);
        if (tracker && tracker.solution.legs) {
             const newLegs = [...tracker.solution.legs];
             if (activeLegIndex >= 0 && activeLegIndex < newLegs.length) {
                 newLegs[activeLegIndex] = {
                     ...newLegs[activeLegIndex],
                     startTime: newStartTime
                 };
                 store.updateTrackerSolution(selectedTrackerId, { legs: newLegs });
             }
        }

    }, []);

    const handleWindowUp = useCallback(() => {
        draggingRef.current = false;
        window.removeEventListener('mousemove', handleWindowMove);
        window.removeEventListener('mouseup', handleWindowUp);
        document.body.style.cursor = 'default';
    }, [handleWindowMove]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleWindowMove);
            window.removeEventListener('mouseup', handleWindowUp);
            document.body.style.cursor = 'default';
        };
    }, [handleWindowMove, handleWindowUp]);


    return (
        <Container>
            <Graphics
                ref={graphicsRef}
                interactive={true}
                pointerdown={handlePointerDown}
                cursor="row-resize"
            />
            <Text
                ref={textRef}
                text=""
                anchor={[1, 0.5]}
                style={
                    new PIXI.TextStyle({
                        fill: 'white',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        dropShadow: true,
                        dropShadowColor: '#000000',
                        dropShadowDistance: 1,
                    })
                }
            />
        </Container>
    );
};

const Grid = ({ width, height, viewMode }: DisplayProps) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);
    const labelsContainerRef = useRef<PIXI.Container | null>(null);

    // Static list of angles for labels
    const labels = useMemo(() => {
        const result = [];
        for (let b = 0; b < 360; b += 30) {
             result.push(b);
        }
        return result;
    }, []);

    useTick(() => {
        const g = graphicsRef.current;
        if (!g) return;

        g.clear();
        // Grid Lines: Very dim green (alpha: 0.1)
        g.lineStyle(1, 0x33FF33, 0.1);

        const { heading: currentHeading } = useSubmarineStore.getState();
        const PIXELS_PER_DEGREE = width / 360;
        const SCREEN_CENTER = width / 2;

        if (viewMode === 'GEO') {
            for (let b = 0; b < 360; b += 30) {
                 const diff = getShortestAngle(b, currentHeading);
                 if (diff >= -180 && diff <= 180) {
                     const x = SCREEN_CENTER + (diff * PIXELS_PER_DEGREE);
                     g.moveTo(x, 0);
                     g.lineTo(x, height);
                     if (diff === -180) {
                         const xRight = width;
                         g.moveTo(xRight, 0);
                         g.lineTo(xRight, height);
                     }
                 }
            }
        } else {
            // DOTS Mode Grid - Keeping it clean with just horizontal lines for now
        }

        // Horizontal lines (Time)
        // Adjust grid line spacing based on timeScale?
        // Or keep pixel spacing fixed and let time vary?
        // Let's keep pixel spacing fixed (e.g. 50px).
        for (let y = 0; y <= height; y += 50) {
            g.moveTo(0, y);
            g.lineTo(width, y);
        }

        // Update Labels Positions
        const container = labelsContainerRef.current;
        if (container && viewMode === 'GEO') {
            const children = container.children as PIXI.Text[];

            labels.forEach((angle, index) => {
                const textObj = children[index];
                if (!textObj) return;

                const diff = getShortestAngle(angle, currentHeading);
                const x = SCREEN_CENTER + (diff * PIXELS_PER_DEGREE);
                textObj.x = x;
                textObj.visible = true; // Always visible in GEO
            });

            // Handle wrap duplicates
            // We can use a dedicated pool of text objects for "right side" duplicates.
            // Let's say children[12+] are for duplicates.
            // Reset them to invisible first.
            for (let i = 12; i < children.length; i++) {
                children[i].visible = false;
            }

            let dupIndex = 12;
            labels.forEach((angle) => {
                const diff = getShortestAngle(angle, currentHeading);
                if (Math.abs(diff + 180) < 0.1) { // Close to -180
                     // This label is at x=0. We also want it at x=width.
                     if (dupIndex < children.length) {
                         const dup = children[dupIndex];
                         dup.text = angle.toString().padStart(3, '0');
                         dup.x = width;
                         dup.visible = true;
                         dupIndex++;
                     }
                }
            });
        } else if (container && viewMode === 'DOTS') {
             // Hide all labels in DOTS mode for now (or implement DOTS specific labels)
             container.visible = false;
        }

        if (container && viewMode === 'GEO') {
             container.visible = true;
        }
    });

    if (viewMode === 'DOTS') return <Container><Graphics ref={graphicsRef} /></Container>;

    return (
        <Container>
            <Graphics ref={graphicsRef} />
            <Container ref={labelsContainerRef}>
                {/* Primary Labels (0-11) */}
                {labels.map(angle => (
                     <Text
                        key={angle}
                        text={angle.toString().padStart(3, '0')}
                        x={0} // Updated in useTick
                        y={10}
                        anchor={0.5}
                        style={
                            new PIXI.TextStyle({
                                fill: '#33FF33',
                                fontSize: 12,
                                fontFamily: 'monospace',
                                // @ts-ignore
                                alpha: 0.5
                            })
                        }
                     />
                ))}
                {/* Duplicate/Wrap Labels (Reserve a few, e.g. 2) */}
                {[0, 1].map(i => (
                     <Text
                        key={`dup-${i}`}
                        text=""
                        x={0}
                        y={10}
                        anchor={0.5}
                        visible={false}
                        style={
                            new PIXI.TextStyle({
                                fill: '#33FF33',
                                fontSize: 12,
                                fontFamily: 'monospace',
                                // @ts-ignore
                                alpha: 0.5
                            })
                        }
                     />
                ))}
            </Container>
        </Container>
    );
};

const TMADisplay = () => {
    const { ref, width: rawWidth, height: rawHeight } = useResize();
    const width = Math.floor(rawWidth);
    const height = Math.floor(rawHeight);
    const [viewMode, setViewMode] = useState<ViewMode>('GEO');
    const selectedTrackerId = useSubmarineStore((state) => state.selectedTrackerId);

    const crtFilter = useMemo(() => {
        try {
            return new CRTFilter({
                lineWidth: 1,
                lineContrast: 0.3,
                noise: 0.1,
                noiseSize: 1.0,
                vignetting: 0.3,
                vignettingAlpha: 1.0,
                vignettingBlur: 0.3,
            });
        } catch (e) {
            console.error("Failed to init CRTFilter", e);
            return null;
        }
    }, []);

    return (
        <div ref={ref} className="relative flex justify-center items-center w-full h-full bg-black overflow-hidden">
            {width > 0 && height > 0 && (
                <Stage width={width} height={height} options={{ background: 0x001100 }}>
                    <Container filters={crtFilter ? [crtFilter] : []}>
                        <Grid width={width} height={height} viewMode={viewMode} />
                        <DotStack width={width} height={height} viewMode={viewMode} />
                        <KnuckleControl width={width} height={height} viewMode={viewMode} containerRef={ref} />
                    </Container>
                </Stage>
            )}

            <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                <button
                    className="bg-gray-800 text-green-500 border border-green-700 px-3 py-1 rounded cursor-pointer hover:bg-gray-700 font-mono text-sm"
                    onClick={() => setViewMode(prev => prev === 'GEO' ? 'DOTS' : 'GEO')}
                >
                    [{viewMode}]
                </button>
                {viewMode === 'DOTS' && (
                    <div className="text-green-500 font-mono text-xs bg-black/50 p-1">
                        SCALE: +/- 10°
                    </div>
                )}
            </div>
        </div>
    );
};

export default TMADisplay;

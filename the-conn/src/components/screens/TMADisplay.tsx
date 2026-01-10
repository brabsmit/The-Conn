import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Container, Graphics, Text, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { calculateTargetPosition, normalizeAngle, getShortestAngle } from '../../lib/tma';
import { useResize } from '../../hooks/useResize';
import PEPDisplay from './PEPDisplay';
import type { TrackerSolution } from '../../store/types';

type ViewMode = 'GEO' | 'DOTS' | 'PEP';

interface DisplayProps {
    width: number;
    height: number;
    viewMode: ViewMode;
}

interface DotStackProps extends DisplayProps {
    ghostSolution?: TrackerSolution | null;
}

const getPixelsPerSecond = (viewScale: string) => {
    if (viewScale === 'MED') return 0.2;
    if (viewScale === 'SLOW') return 0.05;
    return 1.0;
};

const DotStack = ({ width, height, viewMode, ghostSolution }: DotStackProps) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);

    // Keep a ref to props that might change frequently to avoid closure staleness in useTick
    const propsRef = useRef({ ghostSolution, viewMode, width, height });
    useEffect(() => {
        propsRef.current = { ghostSolution, viewMode, width, height };
    }, [ghostSolution, viewMode, width, height]);

    useTick(() => {
        const graphics = graphicsRef.current;
        if (!graphics) return;

        graphics.clear();
        const { ghostSolution, viewMode, width, height } = propsRef.current;
        const { trackers: allTrackers, contacts, gameTime, ownShipHistory, heading: currentHeading, selectedTrackerId, viewScale } = useSubmarineStore.getState();

        const trackers = allTrackers.filter(t => {
            const c = contacts.find(c => c.id === t.contactId);
            return !c || c.status !== 'DESTROYED';
        });

        const PIXELS_PER_SECOND = getPixelsPerSecond(viewScale);

        // Helper to draw a solution line
        const drawSolution = (sol: TrackerSolution, color: number, alpha: number, thickness: number = 2) => {
             const PIXELS_PER_DEGREE = width / 360;
             const SCREEN_CENTER = width / 2;

             graphics.lineStyle(thickness, color, alpha);

             // 1. Current Point
             const currentOwnShip = {
                 x: useSubmarineStore.getState().x,
                 y: useSubmarineStore.getState().y,
                 heading: currentHeading
             };

             const targetPosNow = calculateTargetPosition(sol, gameTime);
             const dxNow = targetPosNow.x - currentOwnShip.x;
             const dyNow = targetPosNow.y - currentOwnShip.y;
             let trueBearingNow = Math.atan2(dxNow, dyNow) * (180 / Math.PI);
             trueBearingNow = normalizeAngle(trueBearingNow);

             const angleDiffNow = getShortestAngle(trueBearingNow, currentHeading);
             const xNow = SCREEN_CENTER + (angleDiffNow * PIXELS_PER_DEGREE);

             graphics.moveTo(xNow, 0);
             let lastX = xNow;

             // 2. History Points
             let osIndex = ownShipHistory.length - 1;

             // Using a fixed step or iterating known history?
             // Ideally we iterate the tracker's bearing history timestamps to match dots,
             // but a solution is continuous.
             // Let's iterate bearing history of the selected tracker (or just steps)
             // Use 60-tick steps (1 sec) roughly

             const selectedTracker = trackers.find(t => t.id === selectedTrackerId);
             const historySource = selectedTracker ? selectedTracker.bearingHistory : [];
             // If no history, maybe just draw a line?
             // Let's use historySource timestamps for alignment

             if (historySource.length === 0) return;

             for (let i = historySource.length - 1; i >= 0; i--) {
                const h = historySource[i];
                const age = gameTime - h.time;
                const y = age * PIXELS_PER_SECOND;

                if (y > height + 100) break;

                while (osIndex >= 0 && ownShipHistory[osIndex].time > h.time + 0.1) {
                    osIndex--;
                }
                if (osIndex < 0) break;

                const ownShipState = ownShipHistory[osIndex];
                if (Math.abs(ownShipState.time - h.time) < 0.1) {
                    const targetPos = calculateTargetPosition(sol, h.time);
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
        };

        const sortedTrackers = [...trackers].sort((a, b) => {
            if (a.id === selectedTrackerId) return 1;
            if (b.id === selectedTrackerId) return -1;
            return 0;
        });

        // GEO Mode (or PEP Right Pane which is effectively GEO)
        if (viewMode === 'GEO' || viewMode === 'PEP') {
            // LOOP ISOLATION: Check if we strictly need to render dots in PEP mode.
            // Current split-screen design allows dots on the right pane.
            // If strictly enforced isolation is needed, we could return here for viewMode === 'PEP'.
            // However, for valid functionality (Geo Reference), we keep it running.
            // We ensure robustness by relying on PEPDisplay's separate native canvas for the heatmap.

            const PIXELS_PER_DEGREE = width / 360;
            const SCREEN_CENTER = width / 2;

            // Draw Ownship Heading Trace (Center Line logic)
            graphics.lineStyle(2, 0x3333ff, 0.6);
            let lastX: number | null = null;
            for (let i = ownShipHistory.length - 1; i >= 0; i--) {
                const history = ownShipHistory[i];
                const age = gameTime - history.time;
                const y = age * PIXELS_PER_SECOND;
                if (y > height + 100) break;
                const angleDiff = getShortestAngle(history.heading, currentHeading);
                const x = SCREEN_CENTER + (angleDiff * PIXELS_PER_DEGREE);
                if (lastX === null) {
                    graphics.moveTo(x, y);
                } else {
                    if (Math.abs(x - lastX) > width / 3) graphics.moveTo(x, y);
                    else graphics.lineTo(x, y);
                }
                lastX = x;
            }

            sortedTrackers.forEach(tracker => {
                const isSelected = tracker.id === selectedTrackerId;

                // Dots
                if (isSelected) {
                    graphics.lineStyle(0);
                    graphics.beginFill(0x33ff33, 1.0);
                } else {
                    graphics.lineStyle(0);
                    graphics.beginFill(0x33ff33, 0.3);
                }

                let osIndex = ownShipHistory.length - 1;
                let lastDrawX = -999;
                let lastDrawY = -999;

                for (let i = tracker.bearingHistory.length - 1; i >= 0; i--) {
                    const history = tracker.bearingHistory[i];
                    const age = gameTime - history.time;
                    const y = age * PIXELS_PER_SECOND;
                    if (y > height + 100) break;

                    while (osIndex >= 0 && ownShipHistory[osIndex].time > history.time + 0.1) osIndex--;
                    if (osIndex < 0) break;

                    if (Math.abs(ownShipHistory[osIndex].time - history.time) < 0.1) {
                        const ownShipState = ownShipHistory[osIndex];
                        const trueBearingAtTime = normalizeAngle(history.bearing + ownShipState.heading);
                        const angleDiff = getShortestAngle(trueBearingAtTime, currentHeading);

                        if (angleDiff >= -180 && angleDiff <= 180) {
                             const x = SCREEN_CENTER + (angleDiff * PIXELS_PER_DEGREE);
                             if (Math.abs(x - lastDrawX) + Math.abs(y - lastDrawY) > 2) {
                                graphics.drawCircle(x, y, 2.5);
                                lastDrawX = x;
                                lastDrawY = y;
                             }
                        }
                    }
                }
                graphics.endFill();

                // Solution Line
                if (tracker.solution) {
                     drawSolution(
                         tracker.solution,
                         isSelected ? 0xFFA500 : 0xffffff,
                         isSelected ? 1.0 : 0.4,
                         isSelected ? 3 : 2
                     );
                }
            });

            // Draw Ghost Solution
            if (ghostSolution && viewMode === 'PEP') {
                drawSolution(ghostSolution, 0xFFFFFF, 0.8, 2); // White
            }

        } else {
            // DOTS Mode
            // ... (Keep existing DOTS implementation) ...
             const RANGE_DEGREES = 20;
             const PIXELS_PER_DEGREE = width / RANGE_DEGREES;
             const SCREEN_CENTER = width / 2;

             graphics.lineStyle(2, 0xffffff, 0.5);
             graphics.moveTo(SCREEN_CENTER, 0);
             graphics.lineTo(SCREEN_CENTER, height);

             const selectedTracker = trackers.find(t => t.id === selectedTrackerId);
             if (selectedTracker && selectedTracker.solution) {
                 graphics.lineStyle(0);
                 graphics.beginFill(0x33ff33, 1.0);
                 let osIndex = ownShipHistory.length - 1;
                 let lastDrawX = -999;
                 let lastDrawY = -999;

                 for (let i = selectedTracker.bearingHistory.length - 1; i >= 0; i--) {
                    const history = selectedTracker.bearingHistory[i];
                    const age = gameTime - history.time;
                    const y = age * PIXELS_PER_SECOND;
                    if (y > height + 100) break;
                    while (osIndex >= 0 && ownShipHistory[osIndex].time > history.time + 0.1) osIndex--;
                    if (osIndex < 0) break;
                    if (Math.abs(ownShipHistory[osIndex].time - history.time) < 0.1) {
                        const ownShipState = ownShipHistory[osIndex];
                        const sensorTrueBearing = normalizeAngle(history.bearing + ownShipState.heading);
                        const targetPos = calculateTargetPosition(selectedTracker.solution!, history.time);
                        const dx = targetPos.x - ownShipState.x;
                        const dy = targetPos.y - ownShipState.y;
                        let solutionTrueBearing = Math.atan2(dx, dy) * (180 / Math.PI);
                        solutionTrueBearing = normalizeAngle(solutionTrueBearing);
                        const residual = getShortestAngle(sensorTrueBearing, solutionTrueBearing);
                        const x = SCREEN_CENTER + (residual * PIXELS_PER_DEGREE);
                        if (x >= 0 && x <= width) {
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
    // ... (Keep existing KnuckleControl implementation) ...
    // To save space, I will copy it from the previous file content since I'm overwriting.
    // Wait, I should ensure I don't lose it.
    // I will include the previous implementation here.

    const graphicsRef = useRef<PIXI.Graphics | null>(null);
    const textRef = useRef<PIXI.Text | null>(null);
    const draggingRef = useRef(false);
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
        const legs = tracker.solution.legs;
        const activeLegIndex = legs.length - 1;
        const activeLeg = legs[activeLegIndex];
        const prevLeg = legs[activeLegIndex - 1];

        stateRef.current.activeLegIndex = activeLegIndex;
        stateRef.current.prevLegStartTime = prevLeg.startTime;

        const age = gameTime - activeLeg.startTime;
        const y = age * pps;

        g.clear();
        g.beginFill(0xffffff, 0.001);
        g.drawRect(0, y - 15, width, 30);
        g.endFill();

        g.lineStyle(2, 0xffffff, 1.0);
        const dashLen = 10;
        const gapLen = 10;
        for (let x = 0; x < width; x += (dashLen + gapLen)) {
            g.moveTo(x, y);
            g.lineTo(Math.min(x + dashLen, width), y);
        }

        text.x = width - 10;
        text.y = y - 20;
        text.text = `LEG ${activeLegIndex + 1} START`;
        text.visible = true;
    });

    const handlePointerDown = () => {
        draggingRef.current = true;
        window.addEventListener('mousemove', handleWindowMove);
        window.addEventListener('mouseup', handleWindowUp);
        document.body.style.cursor = 'row-resize';
    };

    const handleWindowMove = useCallback((e: MouseEvent) => {
        if (!draggingRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        const { gameTime, pps, selectedTrackerId, prevLegStartTime, activeLegIndex } = stateRef.current;
        if (!selectedTrackerId) return;
        let newStartTime = gameTime - (mouseY / pps);
        if (newStartTime > gameTime) newStartTime = gameTime;
        if (newStartTime <= prevLegStartTime) newStartTime = prevLegStartTime + 0.1;

        const store = useSubmarineStore.getState();
        const tracker = store.trackers.find(t => t.id === selectedTrackerId);
        if (tracker && tracker.solution.legs) {
             const newLegs = [...tracker.solution.legs];
             if (activeLegIndex >= 0 && activeLegIndex < newLegs.length) {
                 newLegs[activeLegIndex] = { ...newLegs[activeLegIndex], startTime: newStartTime };
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

    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleWindowMove);
            window.removeEventListener('mouseup', handleWindowUp);
            document.body.style.cursor = 'default';
        };
    }, [handleWindowMove, handleWindowUp]);

    return (
        <Container>
            <Graphics ref={graphicsRef} interactive={true} pointerdown={handlePointerDown} cursor="row-resize" />
            <Text ref={textRef} text="" anchor={[1, 0.5]} style={new PIXI.TextStyle({ fill: 'white', fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold', dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1 })} />
        </Container>
    );
};

const Grid = ({ width, height, viewMode }: DisplayProps) => {
    // ... (Keep existing Grid implementation) ...
    const graphicsRef = useRef<PIXI.Graphics | null>(null);
    const labelsContainerRef = useRef<PIXI.Container | null>(null);

    const labels = useMemo(() => {
        const result = [];
        for (let b = 0; b < 360; b += 30) result.push(b);
        return result;
    }, []);

    useTick(() => {
        const g = graphicsRef.current;
        if (!g) return;
        g.clear();
        g.lineStyle(1, 0x33FF33, 0.1);

        const { heading: currentHeading } = useSubmarineStore.getState();
        const PIXELS_PER_DEGREE = width / 360;
        const SCREEN_CENTER = width / 2;

        if (viewMode === 'GEO' || viewMode === 'PEP') {
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
        }
        for (let y = 0; y <= height; y += 50) {
            g.moveTo(0, y);
            g.lineTo(width, y);
        }

        const container = labelsContainerRef.current;
        if (container && (viewMode === 'GEO' || viewMode === 'PEP')) {
            const children = container.children as PIXI.Text[];
            labels.forEach((angle, index) => {
                const textObj = children[index];
                if (!textObj) return;
                const diff = getShortestAngle(angle, currentHeading);
                const x = SCREEN_CENTER + (diff * PIXELS_PER_DEGREE);
                textObj.x = x;
                textObj.visible = true;
            });
            for (let i = 12; i < children.length; i++) children[i].visible = false;
            let dupIndex = 12;
            labels.forEach((angle) => {
                const diff = getShortestAngle(angle, currentHeading);
                if (Math.abs(diff + 180) < 0.1) {
                     if (dupIndex < children.length) {
                         const dup = children[dupIndex];
                         dup.text = angle.toString().padStart(3, '0');
                         dup.x = width;
                         dup.visible = true;
                         dupIndex++;
                     }
                }
            });
            container.visible = true;
        } else if (container) {
             container.visible = false;
        }
    });

    if (viewMode === 'DOTS') return <Container><Graphics ref={graphicsRef} /></Container>;

    return (
        <Container>
            <Graphics ref={graphicsRef} />
            <Container ref={labelsContainerRef}>
                {labels.map(angle => (
                     <Text key={angle} text={angle.toString().padStart(3, '0')} x={0} y={10} anchor={0.5} style={new PIXI.TextStyle({ fill: '#33FF33', fontSize: 12, fontFamily: 'monospace', alpha: 0.5 })} />
                ))}
                {[0, 1].map(i => (
                     <Text key={`dup-${i}`} text="" x={0} y={10} anchor={0.5} visible={false} style={new PIXI.TextStyle({ fill: '#33FF33', fontSize: 12, fontFamily: 'monospace', alpha: 0.5 })} />
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
    const [ghostSolution, setGhostSolution] = useState<TrackerSolution | null>(null);

    // When switching modes, reset ghost solution
    useEffect(() => { setGhostSolution(null); }, [viewMode]);

    const crtFilter = useMemo(() => {
        try {
            return new CRTFilter({
                lineWidth: 1, lineContrast: 0.3, noise: 0.1, noiseSize: 1.0, vignetting: 0.3, vignettingAlpha: 1.0, vignettingBlur: 0.3,
            });
        } catch (e) {
            console.error("Failed to init CRTFilter", e);
            return null;
        }
    }, []);

    // Layout
    const isPep = viewMode === 'PEP';
    // If PEP, we split: Left = PEP (50%), Right = Geo (50%)
    const displayWidth = isPep ? Math.floor(width / 2) : width;

    return (
        <div ref={ref} className="relative flex w-full h-full bg-black overflow-hidden">
            {width > 0 && height > 0 && (
                <>
                    {/* PEP DISPLAY PANE (Left) */}
                    {isPep && (
                        <div style={{ width: displayWidth, height: height, borderRight: '1px solid #333' }}>
                             <PEPDisplay width={displayWidth} height={height} onGhostSolution={setGhostSolution} />
                        </div>
                    )}

                    {/* MAIN STAGE (Geo/Dots) */}
                    <div style={{ width: displayWidth, height: height }}>
                        <Stage width={displayWidth} height={height} options={{ background: 0x001100 }}>
                            <Container filters={crtFilter ? [crtFilter] : []}>
                                <Grid width={displayWidth} height={height} viewMode={viewMode} />
                                <DotStack width={displayWidth} height={height} viewMode={viewMode} ghostSolution={ghostSolution} />
                                <KnuckleControl width={displayWidth} height={height} viewMode={viewMode} containerRef={ref} />
                            </Container>
                        </Stage>
                    </div>
                </>
            )}

            <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                <div className="flex gap-2">
                     <button
                        className={`px-3 py-1 rounded cursor-pointer font-mono text-sm border ${viewMode === 'GEO' ? 'bg-green-900 text-white border-green-500' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                        onClick={() => setViewMode('GEO')}
                    >
                        GEO
                    </button>
                    <button
                        className={`px-3 py-1 rounded cursor-pointer font-mono text-sm border ${viewMode === 'DOTS' ? 'bg-green-900 text-white border-green-500' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                        onClick={() => setViewMode('DOTS')}
                    >
                        DOTS
                    </button>
                    <button
                        className={`px-3 py-1 rounded cursor-pointer font-mono text-sm border ${viewMode === 'PEP' ? 'bg-green-900 text-white border-green-500' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                        onClick={() => setViewMode('PEP')}
                    >
                        PEP
                    </button>
                </div>

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

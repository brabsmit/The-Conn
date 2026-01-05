import { useMemo, useRef } from 'react';
import { Stage, Container, Graphics, useTick } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { useSubmarineStore } from '../../store/useSubmarineStore';

const DotStack = ({ width, height }: { width: number, height: number }) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);
    const PIXELS_PER_SECOND = 10; // Speed of fall

    useTick(() => {
        const graphics = graphicsRef.current;
        if (!graphics) return;

        graphics.clear();
        const { trackers, gameTime } = useSubmarineStore.getState();

        trackers.forEach(tracker => {
            graphics.beginFill(0x33ff33, 0.8);
            tracker.bearingHistory.forEach(history => {
                const x = (history.bearing / 360) * width;
                const age = gameTime - history.time;
                const y = age * PIXELS_PER_SECOND;

                // Draw only if within bounds (considering radius)
                if (y >= -5 && y <= height + 5) {
                    graphics.drawCircle(x, y, 2.5);
                }
            });
            graphics.endFill();
        });
    });

    return <Graphics ref={graphicsRef} />;
};

const Grid = ({ width, height }: { width: number, height: number }) => {
    const draw = useMemo(() => (g: PIXI.Graphics) => {
        g.clear();
        g.lineStyle(1, 0x005500, 0.5); // Brighter green

        // Vertical lines (Bearing)
        for (let b = 0; b <= 360; b += 30) {
            const x = (b / 360) * width;
            g.moveTo(x, 0);
            g.lineTo(x, height);
        }

        // Horizontal lines (Time)
        for (let y = 0; y <= height; y += 50) {
            g.moveTo(0, y);
            g.lineTo(width, y);
        }
    }, [width, height]);

    return <Graphics draw={draw} />;
};

const TMADisplay = () => {
    const width = 700;
    const height = 500;

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
        <div className="flex justify-center items-center w-full h-full bg-black">
            <Stage width={width} height={height} options={{ background: 0x001100 }}>
                <Container filters={crtFilter ? [crtFilter] : []}>
                     <Grid width={width} height={height} />
                     <DotStack width={width} height={height} />
                </Container>
            </Stage>
        </div>
    );
};

export default TMADisplay;

import { useRef, useMemo, useEffect } from 'react';
import { Stage, Container, Sprite, Text, Graphics, useTick, useApp } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { useResize } from '../../hooks/useResize';

interface DimensionProps {
    width: number;
    height: number;
}

// Waterfall component to handle the shifting texture logic
const Waterfall = ({ width, height }: DimensionProps) => {
    const app = useApp();

    // Use useRef to hold the render texture so it persists across renders
    const spriteRef = useRef<PIXI.Sprite | null>(null);

    // Graphics object for drawing the new line
    const lineGraphics = useMemo(() => new PIXI.Graphics(), []);

    // Ping-pong render textures
    const rtA = useRef<PIXI.RenderTexture>(PIXI.RenderTexture.create({ width, height }));
    const rtB = useRef<PIXI.RenderTexture>(PIXI.RenderTexture.create({ width, height }));
    const currentRtIndex = useRef(0);

    // Effect to recreate textures if dimensions change
    useEffect(() => {
        // Destroy old textures
        rtA.current.destroy(true);
        rtB.current.destroy(true);

        // Create new ones
        rtA.current = PIXI.RenderTexture.create({ width, height });
        rtB.current = PIXI.RenderTexture.create({ width, height });

        // Reset sprite texture
        if (spriteRef.current) {
            spriteRef.current.texture = rtA.current;
        }

    }, [width, height]);

    const designateTracker = useSubmarineStore(state => state.designateTracker);

    // Cleanup textures on unmount (only once)
    useEffect(() => {
        return () => {
             // We don't want to destroy if just resizing, but here we do simple destroy/recreate in the other effect.
             // But on unmount we should clean up.
             // We rely on the other effect to manage RT lifecycle during resize.
             // This cleanup is for component unmount.
             // However, React strict mode or rapid updates might cause issues if we double destroy.
             // Let's trust PIXI's garbage collection or handle it carefully.
        };
    }, []);

    useTick((_delta) => {
        if (!app) return;

        const currentRt = currentRtIndex.current === 0 ? rtA.current : rtB.current;
        const nextRt = currentRtIndex.current === 0 ? rtB.current : rtA.current;

        // Check if textures are valid
        if (!currentRt.valid || !nextRt.valid) return;

        // Create a sprite from the current state (previous frame)
        const prevSprite = new PIXI.Sprite(currentRt);
        prevSprite.y = 1; // Shift down

        // Create the new line
        lineGraphics.clear();

        // Draw simulated random noise data for the line (Background noise)
        for (let x = 0; x < width; x+=2) {
             // Phosphor green varying opacity
             const intensity = Math.random();
             if (intensity > 0.8) {
                 lineGraphics.beginFill(0x33ff33, intensity * 0.8);
                 lineGraphics.drawRect(x, 0, 2, 1);
                 lineGraphics.endFill();
             }
        }

        // Draw Sensor Contacts
        // Access store state directly to avoid re-renders
        const { sensorReadings } = useSubmarineStore.getState();

        sensorReadings.forEach((reading) => {
            // Map bearing to X coordinate.
            // Center (width/2) is 0 degrees (Dead Ahead).
            // Left edge (0% X) is 210 Relative (-150).
            // Right edge (100% X) is 150 Relative (+150).
            // Total span = 300 degrees.

            let signedBearing = reading.bearing;
            if (signedBearing > 180) signedBearing -= 360;

            // Check if visible (within -150 to +150)
            if (signedBearing >= -150 && signedBearing <= 150) {
                 const x = ((signedBearing + 150) / 300) * width;

                 lineGraphics.beginFill(0xccffcc, 1.0);
                 lineGraphics.drawRect(x, 0, 4, 3);
                 lineGraphics.endFill();
            }
        });

        // Render previous frame shifted down to next texture
        app.renderer.render(prevSprite, {
            renderTexture: nextRt,
            clear: true
        });

        // Render new line on top
        app.renderer.render(lineGraphics, {
            renderTexture: nextRt,
            clear: false // Do not clear, draw on top
        });

        // Swap
        currentRtIndex.current = 1 - currentRtIndex.current;

        // Update the visible sprite
        if (spriteRef.current) {
            spriteRef.current.texture = nextRt;
        }

        // Cleanup created sprite to avoid memory leak?
        prevSprite.destroy({ children: true, texture: false, baseTexture: false });
    });

    return (
        <Sprite
            ref={spriteRef}
            texture={rtA.current}
            eventMode="static"
            pointerdown={(e) => {
                if (!e.currentTarget) return;
                const localPoint = e.currentTarget.toLocal(e.global);
                const x = localPoint.x;

                // Inverse Formula:
                // x = ((signedBearing + 150) / 300) * width
                // signedBearing + 150 = (x / width) * 300
                // signedBearing = (x / width) * 300 - 150

                const signedBearing = (x / width) * 300 - 150;

                let bearing = signedBearing;
                if (bearing < 0) bearing += 360;

                designateTracker(bearing);
            }}
        />
    );
};

const NoiseBackground = ({ width, height }: DimensionProps) => {
    // A simple static noise background
    const noiseTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 800; // Generate at fixed resolution and scale, or regenerate? Regenerate is safer for quality.
        // Actually, let's regenerate if dimensions change drastically, but for noise, scaling is fine.
        // For now, let's just make it dynamic.
        canvas.width = width || 100;
        canvas.height = height || 100;

        const ctx = canvas.getContext('2d');
        if (ctx) {
             ctx.fillStyle = '#000000';
             ctx.fillRect(0,0, width, height);
             // random noise
             for(let i=0; i<width*height*0.05; i++) {
                 const x = Math.random() * width;
                 const y = Math.random() * height;
                 ctx.fillStyle = 'rgba(51, 255, 51, 0.1)'; // Faint phosphor green
                 ctx.fillRect(x,y,1,1);
             }
        }
        return PIXI.Texture.from(canvas);
    }, [width, height]);

    return <Sprite texture={noiseTexture} />;
};

const TrackerOverlay = ({ width }: { width: number }) => {
    const graphicsRef = useRef<PIXI.Graphics | null>(null);

    useTick(() => {
        const graphics = graphicsRef.current;
        if (!graphics) return;

        graphics.clear();

        // Access store directly
        const { trackers } = useSubmarineStore.getState();

        trackers.forEach((tracker) => {
             // Map bearing to X coordinate.
             let signedBearing = tracker.currentBearing;
             if (signedBearing > 180) signedBearing -= 360;

             if (signedBearing >= -150 && signedBearing <= 150) {
                 const x = ((signedBearing + 150) / 300) * width;

                 // Draw a triangle pointing down at the top
                 graphics.beginFill(0x33ff33);
                 graphics.moveTo(x, 0);
                 graphics.lineTo(x - 5, 10);
                 graphics.lineTo(x + 5, 10);
                 graphics.closePath();
                 graphics.endFill();
             }
        });
    });

    const trackers = useSubmarineStore((state) => state.trackers);

    return (
        <Container>
            <Graphics ref={graphicsRef} />
            {trackers.map((tracker) => {
                 let signedBearing = tracker.currentBearing;
                 if (signedBearing > 180) signedBearing -= 360;

                 if (signedBearing < -150 || signedBearing > 150) return null;

                 const x = ((signedBearing + 150) / 300) * width;
                 return (
                     <Text
                        key={tracker.id}
                        text={tracker.id}
                        x={x}
                        y={12}
                        anchor={0.5}
                        style={
                            new PIXI.TextStyle({
                                fill: '#33ff33',
                                fontSize: 14,
                                fontFamily: 'monospace',
                                fontWeight: 'bold'
                            })
                        }
                     />
                 );
            })}
        </Container>
    );
};

const SonarDisplay = () => {
    const { ref, width, height } = useResize();

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
        <div ref={ref} className="flex justify-center items-center w-full h-full bg-black overflow-hidden">
            {width > 0 && height > 0 && (
                <Stage width={width} height={height} options={{ background: 0x001100 }}>
                    <Container filters={crtFilter ? [crtFilter] : []}>
                        <NoiseBackground width={width} height={height} />
                        <Waterfall width={width} height={height} />
                        <TrackerOverlay width={width} />
                    </Container>
                </Stage>
            )}
        </div>
    );
};

export default SonarDisplay;

import { useRef, useMemo, useEffect } from 'react';
import { Stage, Container, Sprite, useTick, useApp } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { useSubmarineStore } from '../../store/useSubmarineStore';

// Waterfall component to handle the shifting texture logic
const Waterfall = () => {
    const app = useApp();
    const width = 800;
    const height = 600;

    // Use useRef to hold the render texture so it persists across renders
    const spriteRef = useRef<PIXI.Sprite | null>(null);

    // Graphics object for drawing the new line
    const lineGraphics = useMemo(() => new PIXI.Graphics(), []);

    // Ping-pong render textures
    const rtA = useRef<PIXI.RenderTexture>(PIXI.RenderTexture.create({ width, height }));
    const rtB = useRef<PIXI.RenderTexture>(PIXI.RenderTexture.create({ width, height }));
    const currentRtIndex = useRef(0);

    // Cleanup textures on unmount
    useEffect(() => {
        return () => {
            rtA.current.destroy(true);
            rtB.current.destroy(true);
            lineGraphics.destroy();
        };
    }, [lineGraphics]);

    useTick((_delta) => {
        if (!app) return;

        const currentRt = currentRtIndex.current === 0 ? rtA.current : rtB.current;
        const nextRt = currentRtIndex.current === 0 ? rtB.current : rtA.current;

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
            // Left edge is -180 (180). Right edge is 180.
            // Formula: x = ((bearing + 180) % 360) / 360 * width

            const normalizedBearing = (reading.bearing + 180) % 360;
            const x = (normalizedBearing / 360) * width;

            lineGraphics.beginFill(0xccffcc, 1.0); // Brighter green/white
            lineGraphics.drawRect(x, 0, 4, 3); // Slightly larger dot
            lineGraphics.endFill();
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
        <Sprite ref={spriteRef} texture={rtA.current} />
    );
};

const NoiseBackground = () => {
    // A simple static noise background
    const width = 800;
    const height = 600;

    const noiseTexture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
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
    }, []);

    return <Sprite texture={noiseTexture} />;
};

const SonarDisplay = () => {
    const width = 800;
    const height = 600;

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
                    <NoiseBackground />
                    <Waterfall />
                </Container>
            </Stage>
        </div>
    );
};

export default SonarDisplay;

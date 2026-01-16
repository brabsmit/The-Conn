export class SonarArray {
    public readonly numBeams: number;
    public readonly beamWidth: number; // Degrees (Physical Aperture)
    public readonly beamSpacing: number; // Degrees per bin
    public readonly beams: Float32Array; // Stores Linear Power

    // Persistent world-space noise field (360 degrees)
    // This makes noise spatially coherent - it stays fixed in world coordinates
    // When the submarine turns, noise appears to drift across the display
    private noiseField: Float32Array;

    constructor(numBeams: number = 720, beamWidth: number = 2.0, beamSpacing: number = 0.5) {
        this.numBeams = numBeams;
        this.beamWidth = beamWidth;
        this.beamSpacing = beamSpacing;
        this.beams = new Float32Array(numBeams);

        // Initialize persistent noise field (1-degree resolution for 360 degrees)
        this.noiseField = new Float32Array(360);
        this.generateNoiseField();
    }

    /**
     * Generates persistent world-space noise field
     * Uses smoothed random values to create spatially coherent ocean noise
     */
    private generateNoiseField(): void {
        // Generate base random values
        const rawNoise = new Float32Array(360);
        for (let i = 0; i < 360; i++) {
            // Random variation +/- 1 dB in power domain (20% variation)
            rawNoise[i] = 1.0 + ((Math.random() - 0.5) * 0.2);
        }

        // Smooth the noise to make it spatially coherent (3-point moving average)
        for (let i = 0; i < 360; i++) {
            const prev = rawNoise[(i - 1 + 360) % 360];
            const curr = rawNoise[i];
            const next = rawNoise[(i + 1) % 360];
            this.noiseField[i] = (prev * 0.25 + curr * 0.5 + next * 0.25);
        }
    }

    /**
     * Gets noise dither for a given absolute bearing (world-space)
     * @param absoluteBearing True bearing in degrees (0-360)
     */
    private getNoiseDither(absoluteBearing: number): number {
        const idx = Math.floor(absoluteBearing) % 360;
        return this.noiseField[idx];
    }

    public clear(ambientNoiseDB: number, ownHeading: number = 0): void {
        const baseNoisePower = Math.pow(10, ambientNoiseDB / 10);

        for (let i = 0; i < this.numBeams; i++) {
            // Calculate absolute bearing for this beam
            const relativeBearing = i * this.beamSpacing;
            const absoluteBearing = (relativeBearing + ownHeading) % 360;

            // Get persistent world-space noise dither
            const dither = this.getNoiseDither(absoluteBearing);
            this.beams[i] = baseNoisePower * dither;
        }
    }

    public addSignal(bearing: number, receivedLevelDB: number, effectiveBeamWidth?: number): void {
        const power = Math.pow(10, receivedLevelDB / 10);
        const width = effectiveBeamWidth ?? this.beamWidth;

        // Window optimization: +/- 10 degrees is enough for the main lobe and first side lobe of a narrow beam
        // For wider beams, we need a larger window.
        // 5 * width/2 seems safe for main lobe + side lobes.
        // Convert width (degrees) to indices
        const widthIndices = width / this.beamSpacing;
        const windowSizeIndices = Math.ceil(widthIndices * 2.5);

        // Convert bearing to center index
        const centerIndex = Math.round(bearing / this.beamSpacing);

        const start = centerIndex - windowSizeIndices;
        const end = centerIndex + windowSizeIndices;

        for (let i = start; i <= end; i++) {
             // Handle wrapping
             let beamIndex = i % this.numBeams;
             if (beamIndex < 0) beamIndex += this.numBeams;

             // Calculate actual bearing of this beam index
             const beamBearing = beamIndex * this.beamSpacing;

             // Calculate difference accounting for wrap-around
             let diff = Math.abs(beamBearing - bearing);
             if (diff > 180) diff = 360 - diff;

             const response = this.arrayResponse(diff, width);
             // Energy accumulation (Linear)

             this.beams[beamIndex] += power * response;

             // Clamp to 0 to avoid negative energy physics violation (black holes)
             if (this.beams[beamIndex] < 0) this.beams[beamIndex] = 0;
        }
    }

    public getDb(bearing: number): number {
        // Linear Interpolation
        // Map bearing to float index
        const floatIdx = bearing / this.beamSpacing;
        const idx = Math.floor(floatIdx);
        const t = floatIdx - idx;

        let i1 = idx % this.numBeams;
        if (i1 < 0) i1 += this.numBeams;
        let i2 = (idx + 1) % this.numBeams;
        if (i2 < 0) i2 += this.numBeams;

        const p1 = this.beams[i1];
        const p2 = this.beams[i2];
        const p = p1 + (p2 - p1) * t;

        if (p <= 0) return 0;
        return 10 * Math.log10(p);
    }

    // Sinc Beam Profile with Side Lobes (Realistic Array Response)
    // Real phased arrays produce a sinc² (sinc-squared) pattern with characteristic side lobes
    private arrayResponse(degreesDiff: number, width: number): number {
        // Convert angle to radians for calculation
        // The sinc function mainlobe width relates to beam width by: width ≈ 50.8λ/D
        // For our purposes, we normalize so that the -3dB point matches the specified beam width

        // Normalization factor: For sinc², the first null is at x = π
        // The -3dB beamwidth is approximately x = 1.39 radians
        // We want degreesDiff = width/2 to give us the -3dB point
        const x = (Math.PI * degreesDiff) / (width * 0.72); // 0.72 ≈ π/1.39/3 calibration factor

        // Sinc function with special handling at x=0 to avoid division by zero
        if (Math.abs(x) < 0.001) {
            return 1.0; // lim(x->0) sinc(x) = 1
        }

        const sinc = Math.sin(x) / x;

        // Return sinc² (power pattern, not amplitude)
        // This naturally produces side lobes at ±13.2 dB down from main lobe
        return sinc * sinc;
    }
}

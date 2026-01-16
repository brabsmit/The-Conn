export class SonarArray {
    public readonly numBeams: number;
    public readonly beamWidth: number; // Degrees (Physical Aperture)
    public readonly beamSpacing: number; // Degrees per bin
    public readonly beams: Float32Array; // Stores Linear Power

    // Persistent world-space noise field (360 degrees)
    // This makes noise spatially coherent - it stays fixed in world coordinates
    // When the submarine turns, noise appears to drift across the display
    private noiseField: Float32Array;

    // Temporal evolution for realistic time-varying noise
    private noisePhase: number = 0;
    private noisePhase2: number = 0; // Secondary phase for multi-frequency variation

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
     * Includes slow temporal variation to prevent frozen streaky appearance
     * @param absoluteBearing True bearing in degrees (0-360)
     */
    private getNoiseDither(absoluteBearing: number): number {
        const idx = Math.floor(absoluteBearing) % 360;
        const baseNoise = this.noiseField[idx];

        // Multi-frequency temporal variation to break up streaks
        // Combines multiple sine waves at different frequencies and spatial scales

        // Primary slow variation (~30 second period)
        const slowVariation = Math.sin(this.noisePhase + idx * 0.1) * 0.03;

        // Secondary faster variation (~10 second period, different spatial frequency)
        const fastVariation = Math.sin(this.noisePhase2 + idx * 0.31) * 0.02;

        // Tertiary very slow variation (~60 second period, no spatial component)
        const globalVariation = Math.sin(this.noisePhase * 0.5) * 0.02;

        // Combine variations (total ±7% variation)
        const totalVariation = slowVariation + fastVariation + globalVariation;

        return baseNoise * (1.0 + totalVariation);
    }

    /**
     * Advances the noise field in time (call once per frame)
     * Creates slow evolution to prevent streaky frozen appearance
     */
    public evolveNoise(deltaTime: number = 0.016): void {
        // Advance primary phase slowly (full cycle in ~30 seconds at 60fps)
        this.noisePhase += deltaTime * 0.2;
        if (this.noisePhase > Math.PI * 2) {
            this.noisePhase -= Math.PI * 2;
        }

        // Advance secondary phase faster (full cycle in ~10 seconds)
        this.noisePhase2 += deltaTime * 0.6;
        if (this.noisePhase2 > Math.PI * 2) {
            this.noisePhase2 -= Math.PI * 2;
        }
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

    // Blackman-Windowed Beam Profile (Modern Digital Beamforming)
    // Real passive sonars use amplitude shading (windowing) to suppress side lobes
    // Blackman window provides exceptional side lobe rejection (-58 dB) for clean displays
    private arrayResponse(degreesDiff: number, width: number): number {
        // The Blackman window is applied to the array aperture, which modifies the beam pattern
        // Provides superior side lobe suppression compared to Hamming (-43 dB) or Hanning (-32 dB)
        // Trade-off: Main lobe width increases by ~1.45x compared to uniform weighting

        // Blackman-windowed arrays produce a very clean Gaussian-like main lobe
        // with virtually invisible side lobes (first side lobe at -58 dB)

        // Main lobe - slightly wider than Hamming due to more aggressive windowing
        const sigma = width / 1.6; // Calibrated for Blackman window broadening (~45% wider)
        const gaussian = Math.exp(-(degreesDiff * degreesDiff) / (2 * sigma * sigma));

        // Side lobes are negligible with Blackman windowing
        // First side lobe at -58 dB = power ratio of 0.0000016
        // For visual purposes, we can essentially ignore them (below noise floor)
        const x = (Math.PI * degreesDiff) / (width * 1.2);
        let sideLobe = 0.0;

        if (Math.abs(x) > 0.001) {
            const sinc = Math.sin(x) / x;
            // Suppress side lobes by 45 dB (factor of ~32000 in power)
            sideLobe = (sinc * sinc) * 0.000032;
        }

        // Combine main lobe (Gaussian) with negligible side lobes
        return Math.max(gaussian, sideLobe);
    }
}

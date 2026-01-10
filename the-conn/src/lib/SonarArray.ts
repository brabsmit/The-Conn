export class SonarArray {
    public readonly numBeams: number;
    public readonly beamWidth: number; // Degrees (Physical Aperture)
    public readonly beamSpacing: number; // Degrees per bin
    public readonly beams: Float32Array; // Stores Linear Power

    constructor(numBeams: number = 720, beamWidth: number = 2.0, beamSpacing: number = 0.5) {
        this.numBeams = numBeams;
        this.beamWidth = beamWidth;
        this.beamSpacing = beamSpacing;
        this.beams = new Float32Array(numBeams);
    }

    public clear(ambientNoiseDB: number): void {
        const baseNoisePower = Math.pow(10, ambientNoiseDB / 10);

        for (let i = 0; i < this.numBeams; i++) {
            // Add +/- 1dB of random "Dither" to make it look like grain
            const dither = 1.0 + ((Math.random() - 0.5) * 0.2);
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

    // Gaussian Beam Profile (Task 135.1)
    private arrayResponse(degreesDiff: number, width: number): number {
        // Gaussian Width (Sigma)
        // 1.5 degrees roughly matches a "3 degree beam width" visually.
        // We use width / 2 to align with physical beam width passed.
        const sigma = width / 2.0;

        // The Formula: e^(-x² / 2σ²)
        const response = Math.exp(-(degreesDiff * degreesDiff) / (2 * sigma * sigma));

        return response;
    }
}

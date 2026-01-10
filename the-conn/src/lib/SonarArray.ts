export class SonarArray {
    public readonly numBeams: number;
    public readonly beamWidth: number; // Degrees
    public readonly beams: Float32Array; // Stores Linear Power

    constructor(numBeams: number = 360, beamWidth: number = 2.0) {
        this.numBeams = numBeams;
        this.beamWidth = beamWidth;
        this.beams = new Float32Array(numBeams);
    }

    public clear(ambientNoiseDB: number): void {
        // Base ambient noise power calculation removed as it was unused
        // const basePower = Math.pow(10, ambientNoiseDB / 10);

        for (let i = 0; i < this.numBeams; i++) {
            // Add some random jitter to the ambient noise (in dB domain converted to power)
            // Jitter +/- 2dB?
            const jitter = (Math.random() - 0.5) * 4;
            this.beams[i] = Math.pow(10, (ambientNoiseDB + jitter) / 10);
        }
    }

    public addSignal(bearing: number, receivedLevelDB: number, effectiveBeamWidth?: number): void {
        const power = Math.pow(10, receivedLevelDB / 10);
        const width = effectiveBeamWidth ?? this.beamWidth;

        // Window optimization: +/- 10 degrees is enough for the main lobe and first side lobe of a narrow beam
        // For wider beams, we need a larger window.
        // 5 * width/2 seems safe for main lobe + side lobes.
        const windowSize = Math.ceil(width * 2.5);

        const start = Math.floor(bearing - windowSize);
        const end = Math.ceil(bearing + windowSize);

        for (let i = start; i <= end; i++) {
             // Handle wrapping
             let beamIndex = i % this.numBeams;
             if (beamIndex < 0) beamIndex += this.numBeams;

             const diff = Math.abs(i - bearing);

             const response = this.arrayResponse(diff, width);
             // Energy accumulation (Linear)

             this.beams[beamIndex] += power * response;

             // Clamp to 0 to avoid negative energy physics violation (black holes)
             if (this.beams[beamIndex] < 0) this.beams[beamIndex] = 0;
        }
    }

    public getDb(bearing: number): number {
        // Linear Interpolation
        const idx = Math.floor(bearing);
        const t = bearing - idx;

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

    // Normalized Sinc-like function
    private arrayResponse(degreesDiff: number, width: number): number {
        if (Math.abs(degreesDiff) < 0.001) return 1.0;

        // Zero crossing at beamWidth (width)
        // Sub-Task 110.1: Tighten main lobe by scaling frequency (divide by 0.5)
        const x = (degreesDiff / (width * 0.5)) * Math.PI;

        let response = Math.sin(x) / x;

        // Sub-Task 110.2: Side Lobe Suppression
        // If outside main lobe (x > PI), suppress by 50%
        if (Math.abs(x) > Math.PI) {
            response *= 0.5;
        }

        return response;
    }
}

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
        const basePower = Math.pow(10, ambientNoiseDB / 10);
        for (let i = 0; i < this.numBeams; i++) {
            // Add some random jitter to the ambient noise (in dB domain converted to power)
            // Jitter +/- 2dB?
            const jitter = (Math.random() - 0.5) * 4;
            this.beams[i] = Math.pow(10, (ambientNoiseDB + jitter) / 10);
        }
    }

    public addSignal(bearing: number, receivedLevelDB: number): void {
        const power = Math.pow(10, receivedLevelDB / 10);

        // Window optimization: +/- 10 degrees is enough for the main lobe and first side lobe of a narrow beam
        const windowSize = 10;

        const start = Math.floor(bearing - windowSize);
        const end = Math.ceil(bearing + windowSize);

        for (let i = start; i <= end; i++) {
             // Handle wrapping
             let beamIndex = i % this.numBeams;
             if (beamIndex < 0) beamIndex += this.numBeams;

             let diff = Math.abs(i - bearing);

             const response = this.arrayResponse(diff);
             // Energy accumulation (Linear)
             // response can be negative (sinc), but power is usually positive?
             // Sinc is amplitude response. Power response is Sinc^2.
             // "Energy += RL * Sinc" in the prompt.
             // If RL is Intensity (Power), we should use Power Pattern (Sinc^2).
             // If RL is Amplitude (Pressure), we sum amplitudes then square.
             // But simulating phase interference (constructive/destructive) requires complex numbers or keeping phase.
             // The prompt mentions "Beam Convolution... SincFunction".
             // And "Energy += RL * Sinc".
             // If Sinc is negative, Energy decreases? That implies interference.
             // But we are adding to a float array of "Energy".
             // Let's assume incoherent summation for now (Power + Power), but apply the Sinc *Pattern* as a weight?
             // "Beam 093 gets -10% (The Null)". This implies subtracting from the noise floor?
             // Physics: A null in a beam pattern means the array is deaf in that direction.
             // It does NOT mean it subtracts existing noise from other directions.
             // However, the prompt might be asking for a visual "dip" around the contact (Destructive Interference simulation).

             // Let's interpret "Energy" as "Signal Strength" which can be manipulated.
             // If I add negative energy, I dig a hole in the noise floor.
             // Let's try Linear summation with Sinc.

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
    private arrayResponse(degreesDiff: number): number {
        if (Math.abs(degreesDiff) < 0.001) return 1.0;

        // Zero crossing at beamWidth
        const x = (degreesDiff / this.beamWidth) * Math.PI;

        return Math.sin(x) / x;
    }
}

// Use a singleton audio context to avoid recreating it
let audioCtx: AudioContext | null = null;

export const useSonarAudio = () => {
    const playPing = (volume: number = 0.5) => {
        try {
            if (!audioCtx) {
                // Initialize context on first user interaction if possible,
                // but here we might just try to create it.
                // Browsers usually block AudioContext until interaction.
                // We assume the user has clicked "Start" or similar by now.
                audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            // High frequency ping
            osc.type = 'sine';
            osc.frequency.setValueAtTime(3500, audioCtx.currentTime); // 3.5kHz as per spec
            osc.frequency.exponentialRampToValueAtTime(3400, audioCtx.currentTime + 0.1);

            // Envelope
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.1);

            console.log("Ping")

        } catch (e) {
            console.warn("Audio playback failed", e);
        }
    };

    return { playPing };
};

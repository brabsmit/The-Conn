import { useEffect, useRef } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { Panel } from '../ui/Panel';

export const HelmScreen = () => {
  // Use individual selectors to avoid object reference instability (infinite render loops)
  const orderedHeading = useSubmarineStore(state => state.orderedHeading);
  const orderedSpeed = useSubmarineStore(state => state.orderedSpeed);
  const orderedDepth = useSubmarineStore(state => state.orderedDepth);

  // Actions are stable, but we can select them individually too
  const setOrderedHeading = useSubmarineStore(state => state.setOrderedHeading);
  const setOrderedSpeed = useSubmarineStore(state => state.setOrderedSpeed);
  const setOrderedDepth = useSubmarineStore(state => state.setOrderedDepth);
  const addLog = useSubmarineStore(state => state.addLog);

  const cavitating = useSubmarineStore(state => state.cavitating);
  const alertLevel = useSubmarineStore(state => state.alertLevel);
  const incomingTorpedoDetected = useSubmarineStore(state => state.incomingTorpedoDetected);

  // Use refs for high-frequency updates (actual values)
  const headingRef = useRef<HTMLSpanElement>(null);
  const depthRef = useRef<HTMLSpanElement>(null);
  const speedRef = useRef<HTMLSpanElement>(null);
  const noiseBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial Update
    const state = useSubmarineStore.getState();
    if (headingRef.current) headingRef.current.innerText = Math.round(state.heading).toString().padStart(3, '0');
    if (depthRef.current) depthRef.current.innerText = Math.round(state.depth).toString().padStart(4, '0');
    if (speedRef.current) speedRef.current.innerText = state.speed.toFixed(1);
    if (noiseBarRef.current) noiseBarRef.current.style.width = `${Math.min(100, state.ownshipNoiseLevel * 100)}%`;

    const unsub = useSubmarineStore.subscribe((state) => {
        if (headingRef.current) headingRef.current.innerText = Math.round(state.heading).toString().padStart(3, '0');
        if (depthRef.current) depthRef.current.innerText = Math.round(state.depth).toString().padStart(4, '0');
        if (speedRef.current) speedRef.current.innerText = state.speed.toFixed(1);
        if (noiseBarRef.current) noiseBarRef.current.style.width = `${Math.min(100, state.ownshipNoiseLevel * 100)}%`;
    });

    return unsub;
  }, []);

  return (
    <Panel title="Helm" className="h-full">
        <div className="flex flex-row gap-4 h-full items-center px-4">

            {/* Noise Control */}
            <div className={`flex-1 bg-black/30 p-2 rounded border border-white/5 flex flex-col justify-center h-14 ${cavitating ? 'animate-pulse border-red-500/50' : ''}`}>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-zinc-500">NOISE</span>
                    {cavitating && <span className="text-[10px] text-red-500 font-bold">CAVITATING</span>}
                </div>
                <div className="w-full h-4 bg-black/50 rounded-full relative overflow-hidden border border-white/10">
                    {/* Gradient Bar */}
                    <div
                        ref={noiseBarRef}
                        className="h-full transition-all duration-200 ease-out"
                        style={{
                            width: '10%',
                            background: 'linear-gradient(90deg, #22c55e 0%, #eab308 60%, #ef4444 100%)'
                        }}
                    />
                    {/* Threshold Marker (e.g. at 50% relative to max likely noise) */}
                    {/* Let's assume ambient/threshold is around 0.5 noise level, which maps to 50% width if max is 1.0 */}
                    <div className="absolute top-0 bottom-0 w-[2px] bg-white/50 left-[50%]" title="Ambient Threshold" />
                </div>
            </div>

            {/* Heading Control */}
            <div className="flex-1 bg-black/30 p-2 rounded border border-white/5 flex flex-row items-center justify-between h-14">
                <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500">HEADING</span>
                    <span ref={headingRef} className="text-xl text-amber-500 font-bold tabular-nums">000</span>
                </div>
                <div className="flex items-center gap-2">
                     <span className="text-[10px] text-amber-500/50">ORDER</span>
                     <input
                        type="number"
                        className="w-16 bg-transparent text-right text-lg text-amber-500 border-b border-white/10 focus:outline-none focus:border-amber-500 font-bold tabular-nums"
                        value={Math.round(orderedHeading)}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!isNaN(val)) setOrderedHeading(val);
                        }}
                     />
                </div>
            </div>

            {/* Depth Control */}
            <div className="flex-1 bg-black/30 p-2 rounded border border-white/5 flex flex-row items-center justify-between h-14">
                <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500">DEPTH</span>
                    <span ref={depthRef} className="text-xl text-amber-500 font-bold tabular-nums">0000</span>
                </div>
                <div className="flex items-center gap-2">
                     <span className="text-[10px] text-amber-500/50">ORDER</span>
                     <input
                        type="number"
                        className="w-16 bg-transparent text-right text-lg text-amber-500 border-b border-white/10 focus:outline-none focus:border-amber-500 font-bold tabular-nums"
                        value={Math.round(orderedDepth)}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!isNaN(val)) setOrderedDepth(val);
                        }}
                     />
                </div>
            </div>

            {/* Speed Control */}
            <div className="flex-1 bg-black/30 p-2 rounded border border-white/5 flex flex-row items-center justify-between h-14">
                <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500">SPEED</span>
                    <span ref={speedRef} className="text-xl text-amber-500 font-bold tabular-nums">0.0</span>
                </div>
                <div className="flex items-center gap-2">
                     <span className="text-[10px] text-amber-500/50">ORDER</span>
                     <input
                        type="number"
                        className="w-16 bg-transparent text-right text-lg text-amber-500 border-b border-white/10 focus:outline-none focus:border-amber-500 font-bold tabular-nums"
                        value={Math.round(orderedSpeed)}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!isNaN(val)) setOrderedSpeed(val);
                        }}
                     />
                </div>
            </div>

            {/* EMERGENCY EVASION */}
            {alertLevel === 'COMBAT' && incomingTorpedoDetected && (
                <div className="flex-1 flex items-center justify-center">
                    <button
                        onClick={() => {
                            setOrderedSpeed(30);
                            setOrderedDepth(800);
                            addLog("Conn, Helm: Evasion! Cavitating! Making for depth!", "ALERT");
                        }}
                        className="w-full h-14 bg-red-900 border-2 border-red-500 text-white font-bold animate-pulse hover:bg-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)] tracking-widest"
                    >
                        EMERGENCY EVASION
                    </button>
                </div>
            )}

        </div>
    </Panel>
  );
};

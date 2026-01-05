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

  // Use refs for high-frequency updates (actual values)
  const headingRef = useRef<HTMLSpanElement>(null);
  const depthRef = useRef<HTMLSpanElement>(null);
  const speedRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Initial Update
    const state = useSubmarineStore.getState();
    if (headingRef.current) headingRef.current.innerText = Math.round(state.heading).toString().padStart(3, '0');
    if (depthRef.current) depthRef.current.innerText = Math.round(state.depth).toString().padStart(4, '0');
    if (speedRef.current) speedRef.current.innerText = state.speed.toFixed(1);

    const unsub = useSubmarineStore.subscribe((state) => {
        if (headingRef.current) headingRef.current.innerText = Math.round(state.heading).toString().padStart(3, '0');
        if (depthRef.current) depthRef.current.innerText = Math.round(state.depth).toString().padStart(4, '0');
        if (speedRef.current) speedRef.current.innerText = state.speed.toFixed(1);
    });

    return unsub;
  }, []);

  return (
    <Panel title="Helm" className="h-full">
        <div className="flex flex-row gap-4 h-full items-center px-4">

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

        </div>
    </Panel>
  );
};

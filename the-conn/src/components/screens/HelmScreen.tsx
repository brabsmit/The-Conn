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
    <Panel title="Helm">
    <div className="grid grid-cols-3 gap-2 h-full">
      <div className="bg-black/30 p-2 rounded border border-white/5 flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-500">HEADING</span>
          <input
            type="number"
            className="w-12 bg-transparent text-right text-xs text-amber-500/50 border-b border-white/10 focus:outline-none focus:border-amber-500"
            value={Math.round(orderedHeading)}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!isNaN(val)) setOrderedHeading(val);
            }}
          />
        </div>
        <span ref={headingRef} className="text-2xl text-amber-500">000</span>
      </div>
      <div className="bg-black/30 p-2 rounded border border-white/5 flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-500">DEPTH</span>
          <input
            type="number"
            className="w-12 bg-transparent text-right text-xs text-amber-500/50 border-b border-white/10 focus:outline-none focus:border-amber-500"
            value={Math.round(orderedDepth)}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!isNaN(val)) setOrderedDepth(val);
            }}
          />
        </div>
        <span ref={depthRef} className="text-2xl text-amber-500">0000</span>
      </div>
      <div className="bg-black/30 p-2 rounded border border-white/5 flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <span className="text-xs text-zinc-500">SPEED</span>
          <input
            type="number"
            className="w-12 bg-transparent text-right text-xs text-amber-500/50 border-b border-white/10 focus:outline-none focus:border-amber-500"
            value={Math.round(orderedSpeed)}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!isNaN(val)) setOrderedSpeed(val);
            }}
          />
        </div>
        <span ref={speedRef} className="text-2xl text-amber-500">0.0</span>
      </div>
    </div>
  </Panel>
  );
};

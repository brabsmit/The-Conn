import { Panel } from './components/ui/Panel';
import { useSubmarineStore } from './store/useSubmarineStore';
import { useInterval } from './hooks/useInterval';
import SonarDisplay from './components/screens/SonarDisplay';

function App() {
  const {
    heading,
    speed,
    depth,
    orderedHeading,
    orderedSpeed,
    orderedDepth,
    setOrderedHeading,
    setOrderedSpeed,
    setOrderedDepth,
    tick
  } = useSubmarineStore();

  useInterval(() => {
    tick();
  }, 16); // ~60fps

  return (
    // LAYER 1: The Bulkhead (Background)
    <div className="min-h-screen bg-bulkhead bg-noise p-8 flex items-center justify-center font-mono">
      
      {/* The Main Desk Container */}
      <div className="w-full max-w-6xl grid grid-cols-12 grid-rows-6 gap-6 h-[800px]">
        
        {/* SECTION 1: SENSOR ARRAY (Left Side) */}
        <div className="col-span-4 row-span-6 flex flex-col gap-4">
          <Panel title="Sonar Array" className="flex-1 overflow-hidden">
             <div className="w-full h-full bg-black rounded shadow-inset border border-white/10 relative">
                <SonarDisplay />
             </div>
          </Panel>
          
          <Panel title="Signal Analysis" className="h-1/3">
            <div className="grid grid-cols-4 gap-2 h-full">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-black/40 border border-white/5 relative">
                   <div className="absolute bottom-0 w-full bg-phosphor/20" style={{height: `${Math.random() * 100}%`}}></div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* SECTION 2: TACTICAL PLOT (Center/Right Top) */}
        <Panel title="Target Motion Analysis" className="col-span-8 row-span-4">
           <div className="w-full h-full bg-zinc-900/50 rounded border border-dashed border-zinc-700 relative p-4">
              <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-phosphor rounded-full shadow-[0_0_10px_rgba(51,255,51,0.8)]" />
              <div className="text-zinc-600 text-xs">Waiting for solution input...</div>
           </div>
        </Panel>

        {/* SECTION 3: SHIP CONTROL (Center/Right Bottom) */}
        <div className="col-span-8 row-span-2 grid grid-cols-2 gap-6">
          
          {/* Helm Station */}
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
                <span className="text-2xl text-amber-500">{Math.round(heading).toString().padStart(3, '0')}</span>
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
                <span className="text-2xl text-amber-500">{Math.round(depth).toString().padStart(4, '0')}</span>
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
                <span className="text-2xl text-amber-500">{speed.toFixed(1)}</span>
              </div>
            </div>
          </Panel>

          {/* Weapons Control */}
          <Panel title="Fire Control" variant="danger">
             <div className="flex gap-2 h-full items-center justify-around">
                <button className="w-16 h-16 rounded-full bg-red-900 border-4 border-red-950 shadow-hard flex items-center justify-center hover:bg-red-800 active:shadow-inset active:translate-y-1 transition-all">
                  <span className="text-xs font-bold text-red-200">FIRE</span>
                </button>
                <div className="flex flex-col gap-1">
                   <div className="w-24 h-6 bg-black border border-red-900/50 flex items-center px-2">
                      <span className="text-red-500 text-xs">TUBE 1: RDY</span>
                   </div>
                   <div className="w-24 h-6 bg-black border border-red-900/50 flex items-center px-2">
                      <span className="text-red-500 text-xs">TUBE 2: LOAD</span>
                   </div>
                </div>
             </div>
          </Panel>
        </div>

      </div>
    </div>
  );
}

export default App;
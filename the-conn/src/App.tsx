import { Panel } from './components/ui/Panel';
import { useSubmarineStore } from './store/useSubmarineStore';
import { useInterval } from './hooks/useInterval';
import SonarDisplay from './components/screens/SonarDisplay';
import TMADisplay from './components/screens/TMADisplay';
import { TMAControls } from './components/panels/TMAControls';
import { TopBar } from './components/layout/TopBar';
import { HelmScreen } from './components/screens/HelmScreen';

function App() {
  const tick = useSubmarineStore(state => state.tick);

  useInterval(() => {
    tick();
  }, 16); // ~60fps

  return (
    // LAYER 1: The Bulkhead (Background)
    <div className="min-h-screen bg-bulkhead bg-noise p-8 pt-20 flex items-center justify-center font-mono">
      
      <TopBar />

      {/* The Main Desk Container */}
      <div className="w-full max-w-6xl grid grid-cols-12 grid-rows-6 gap-6 h-[1600px]">
        
        {/* SECTION 1: SENSOR ARRAY */}
        <div className="col-span-10 row-span-6 flex flex-col gap-4">
          <Panel title="Sonar Array" className="flex-1 overflow-hidden">
             <div className="w-full h-full bg-black rounded shadow-inset border border-white/10 relative">
                <SonarDisplay />
             </div>
          </Panel>
        </div>

        {/* SECTION 2: TACTICAL PLOT (Center/Right Top) */}
        <Panel title="Target Motion Analysis" className="col-span-10 row-span-6 flex flex-col gap-2">
           <div className="flex flex-row h-full">
               <div className="flex-grow bg-zinc-900/50 rounded border border-white/10 relative overflow-hidden">
                   <TMADisplay />
               </div>
               <div className="w-48 h-full">
                   <TMAControls />
               </div>
           </div>
        </Panel>

        {/* SECTION 3: SHIP CONTROL (Center/Right Bottom) */}
        <div className="col-span-8 row-span-2 grid grid-cols-2 gap-6">
          
          {/* Helm Station */}
          <HelmScreen />

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

import { Panel } from './components/ui/Panel';
import { useSubmarineStore } from './store/useSubmarineStore';
import { useInterval } from './hooks/useInterval';
import { useEffect } from 'react';
import SonarDisplay from './components/screens/SonarDisplay';
import TMADisplay from './components/screens/TMADisplay';
import WCSDisplay from './components/screens/WCSDisplay';
import GeoDisplay from './components/screens/GeoDisplay';
import { TMAControls } from './components/panels/TMAControls';
import { ContactManager } from './components/panels/ContactManager';
import { TopBar } from './components/layout/TopBar';
import { HelmScreen } from './components/screens/HelmScreen';
import { AlertOverlay } from './components/effects/AlertOverlay';

function App() {
  const tick = useSubmarineStore(state => state.tick);
  const activeStation = useSubmarineStore(state => state.activeStation);
  const setActiveStation = useSubmarineStore(state => state.setActiveStation);

  useInterval(() => {
    tick();
  }, 16); // ~60fps

  return (
    // MAIN CONTAINER: Triptych Layout
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bulkhead bg-noise font-mono relative">
      <AlertOverlay />
      
      {/* LAYER 1: Top Bar (Fixed Height) */}
      <TopBar />

      {/* LAYER 2: Main Workspace (Flex Grow) */}
      <div className="flex-grow flex w-full overflow-hidden p-4 gap-4 relative z-10">
        
        {/* PANE A: Sonar Panel (Left) */}
        <div className="w-[350px] flex-shrink-0 h-full flex flex-col gap-4">
          <Panel
            title="Sonar Array"
            className="h-[70%] flex flex-col overflow-hidden"
          >
             <div className="flex-grow w-full bg-black rounded shadow-inset border border-white/10 relative overflow-hidden">
                <SonarDisplay />
             </div>
          </Panel>

          <Panel
            title="Contacts"
            className="flex-grow flex flex-col overflow-hidden"
          >
             <div className="flex-grow w-full bg-zinc-900 rounded shadow-inset border border-white/10 relative overflow-hidden">
                <ContactManager />
             </div>
          </Panel>
        </div>

        {/* PANE B: Main Scope (Center) */}
        <div className="flex-grow h-full relative overflow-hidden flex flex-col">
            <Panel
              title={
                activeStation === 'TMA' ? "Tactical Plot" :
                activeStation === 'WCS' ? "Weapons Control" :
                "Navigation Plot"
              }
              className="h-full flex flex-col"
            >
               <div className="flex-grow min-h-0 bg-zinc-900/50 rounded border border-white/10 relative overflow-hidden">
                   {activeStation === 'TMA' && <TMADisplay />}
                   {activeStation === 'WCS' && <WCSDisplay />}
                   {activeStation === 'NAV' && <GeoDisplay />}
               </div>

               {/* Mode Select Buttons */}
               <div className="mt-4 flex justify-center gap-2">
                 <button
                   onClick={() => setActiveStation('TMA')}
                   className={`px-6 py-2 rounded text-xs font-bold tracking-widest border transition-colors ${
                     activeStation === 'TMA'
                       ? 'bg-amber-500/20 border-amber-500 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                       : 'bg-black/40 border-white/10 text-zinc-500 hover:border-white/30 hover:text-zinc-300'
                   }`}
                 >
                   TMA STATION
                 </button>
                 <button
                   onClick={() => setActiveStation('WCS')}
                   className={`px-6 py-2 rounded text-xs font-bold tracking-widest border transition-colors ${
                     activeStation === 'WCS'
                       ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                       : 'bg-black/40 border-white/10 text-zinc-500 hover:border-white/30 hover:text-zinc-300'
                   }`}
                 >
                   WCS STATION
                 </button>
                 <button
                   onClick={() => setActiveStation('NAV')}
                   className={`px-6 py-2 rounded text-xs font-bold tracking-widest border transition-colors ${
                     activeStation === 'NAV'
                       ? 'bg-cyan-500/20 border-cyan-500 text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                       : 'bg-black/40 border-white/10 text-zinc-500 hover:border-white/30 hover:text-zinc-300'
                   }`}
                 >
                   NAV STATION
                 </button>
               </div>
            </Panel>
        </div>

        {/* PANE C: Control Sidebar (Right) */}
        <div className="w-[300px] flex-shrink-0 h-full flex flex-col">
             <Panel title="TMA Controls" className="h-full flex flex-col overflow-hidden">
                <div className="flex-grow overflow-hidden">
                   <TMAControls />
                </div>
             </Panel>
        </div>

      </div>

      {/* LAYER 3: Helm Strip (Bottom, Fixed Height) */}
      <div className="h-[100px] w-full flex-shrink-0 px-4 pb-4 z-10">
          <HelmScreen />
      </div>

    </div>
  );
}

export default App;

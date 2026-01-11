import { useEffect } from 'react';
import { Panel } from './components/ui/Panel';
import { useSubmarineStore } from './store/useSubmarineStore';
import { useInterval } from './hooks/useInterval';
import SonarDisplay from './components/screens/SonarDisplay';
import TMADisplay from './components/screens/TMADisplay';
import WCSDisplay from './components/screens/WCSDisplay';
import GeoDisplay from './components/screens/GeoDisplay';
import { TMAControls } from './components/panels/TMAControls';
import { ContactManager } from './components/panels/ContactManager';
import { TopBar } from './components/layout/TopBar';
import { HelmScreen } from './components/screens/HelmScreen';
import { AlertOverlay } from './components/effects/AlertOverlay';
import { DebriefModal } from './components/modals/DebriefModal';
import { ScenarioSelect } from './components/screens/ScenarioSelect';

function App() {
  const tick = useSubmarineStore(state => state.tick);
  const activeStation = useSubmarineStore(state => state.activeStation);
  const setActiveStation = useSubmarineStore(state => state.setActiveStation);
  const appState = useSubmarineStore(state => state.appState);
  const toggleGodMode = useSubmarineStore(state => state.toggleGodMode);

  // Expose store to window for debugging and Playwright tests
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore - Exposing for debug/test
      window.useSubmarineStore = useSubmarineStore;
    }
  }, []);

  // Global Key Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // God Mode Toggle: Ctrl + Shift + D
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        toggleGodMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleGodMode]);

  useInterval(() => {
    tick();
  }, 16); // ~60fps

  if (appState === 'MENU') {
      return <ScenarioSelect />;
  }

  return (
    // MAIN CONTAINER: Triptych Layout
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bulkhead bg-noise font-mono relative">
      <AlertOverlay />
      <DebriefModal />
      
      {/* LAYER 1: Top Bar (Fixed Height) */}
      <TopBar />

      {/* LAYER 2: Main Workspace (Flex Grow) */}
      <div className="flex-grow grid grid-cols-[33fr_42fr_25fr] w-full overflow-hidden p-4 gap-4 relative z-10">
        
        {/* PANE A: Sonar Panel (Left) */}
        <div className="h-full flex flex-col gap-4 min-w-0">
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
        <div className="h-full relative overflow-hidden flex flex-col min-w-0">
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
        <div className="h-full flex flex-col min-w-0">
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

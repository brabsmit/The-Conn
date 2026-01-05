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
    // MAIN CONTAINER: Triptych Layout
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bulkhead bg-noise font-mono">
      
      {/* LAYER 1: Top Bar (Fixed Height) */}
      <TopBar />

      {/* LAYER 2: Main Workspace (Flex Grow) */}
      <div className="flex-grow flex w-full overflow-hidden p-4 gap-4">
        
        {/* PANE A: Sonar Panel (Left) */}
        <div className="w-[350px] flex-shrink-0 h-full flex flex-col">
          <Panel title="Sonar Array" className="h-full flex flex-col overflow-hidden">
             <div className="flex-grow w-full bg-black rounded shadow-inset border border-white/10 relative overflow-hidden">
                <SonarDisplay />
             </div>
          </Panel>
        </div>

        {/* PANE B: Main Scope (Center) */}
        <div className="flex-grow h-full relative overflow-hidden flex flex-col">
            <Panel title="Tactical Plot" className="h-full flex flex-col">
               <div className="flex-grow bg-zinc-900/50 rounded border border-white/10 relative overflow-hidden">
                   <TMADisplay />
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
      <div className="h-[100px] w-full flex-shrink-0 px-4 pb-4">
          <HelmScreen />
      </div>

    </div>
  );
}

export default App;

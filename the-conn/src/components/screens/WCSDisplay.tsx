import { useState } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import type { Tube, TubeStatus } from '../../store/useSubmarineStore';
import { calculateProjectedSolution } from '../../lib/tma';

const TubeStatusLight = ({ status }: { status: TubeStatus }) => {
  let color = 'bg-zinc-800';
  let pulse = '';

  switch (status) {
    case 'EMPTY': color = 'bg-zinc-900 border-zinc-700'; break;
    case 'LOADING': color = 'bg-amber-900/50 border-amber-600'; pulse = 'animate-pulse'; break;
    case 'DRY': color = 'bg-amber-600 border-amber-400'; break;
    case 'FLOODING': color = 'bg-blue-900/50 border-blue-600'; pulse = 'animate-pulse'; break;
    case 'WET': color = 'bg-blue-600 border-blue-400'; break;
    case 'EQUALIZING': color = 'bg-cyan-900/50 border-cyan-600'; pulse = 'animate-pulse'; break;
    case 'EQUALIZED': color = 'bg-cyan-600 border-cyan-400'; break;
    case 'OPENING': color = 'bg-red-900/50 border-red-600'; pulse = 'animate-pulse'; break;
    case 'OPEN': color = 'bg-red-600 border-red-400'; break;
    case 'FIRING': color = 'bg-red-500 border-white'; pulse = 'animate-pulse'; break;
  }

  return (
    <div className={`w-3 h-3 rounded-full border ${color} ${pulse} shadow-[0_0_8px_rgba(0,0,0,0.5)] flex-shrink-0`} />
  );
};

const ProgressBar = ({ progress }: { progress: number }) => (
    <div className="w-full h-full bg-zinc-900 rounded-full overflow-hidden border border-white/5 relative">
        {/* Vertical fill for "water level" effect or just h-full horizontal?
            Given the constraints, let's make it fill from bottom if it's "water level",
            but the original was horizontal width. I'll keep width for compatibility but make container height flexible.
            Actually, let's stick to horizontal width fill, but container is flexible height.
        */}
        <div className="h-full bg-amber-500 transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
    </div>
);

const TubeStrip = ({ tube, isSelected, onClick }: { tube: Tube; isSelected: boolean; onClick: () => void }) => {
    return (
        <div
            onClick={onClick}
            className={`
                w-full h-full p-2 border border-white/10 rounded flex flex-col justify-between cursor-pointer transition-all overflow-hidden
                ${isSelected ? 'bg-white/5 border-amber-500/50 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]' : 'bg-black/40 hover:bg-white/5'}
            `}
        >
            <div className="flex justify-between items-center mb-2 flex-shrink-0">
                 <span className={`font-mono text-xl font-bold ${isSelected ? 'text-amber-500' : 'text-zinc-600'}`}>
                     {tube.id}
                 </span>
                 <TubeStatusLight status={tube.status} />
            </div>

            <div className="flex-grow flex flex-col justify-center gap-2 min-h-0 relative">
                <span className={`text-[10px] tracking-wider font-bold text-center ${isSelected ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {tube.status}
                </span>
                {['LOADING', 'FLOODING', 'EQUALIZING', 'OPENING', 'FIRING'].includes(tube.status) && (
                    <div className="h-1/4 w-full">
                        <ProgressBar progress={tube.progress} />
                    </div>
                )}
            </div>

             <div className="mt-2 text-[10px] text-zinc-500 font-mono flex-shrink-0">
                 {tube.weaponData ? (
                     <div className="flex flex-col gap-0.5">
                         <span>MK-48 ADCAP</span>
                         <span>MODE: {tube.weaponData.searchMode}</span>
                     </div>
                 ) : (
                     <span className="opacity-50">NO WEAPON</span>
                 )}
             </div>
        </div>
    );
};

const WCSDisplay = () => {
    const tubes = useSubmarineStore(state => state.tubes);
    const trackers = useSubmarineStore(state => state.trackers);
    // Use shallow selector or individual to avoid object creation if possible,
    // but without 'shallow', we just accept re-renders or pull direct values.
    // For now, let's keep it simple but stable.
    const x = useSubmarineStore(state => state.x);
    const y = useSubmarineStore(state => state.y);
    const heading = useSubmarineStore(state => state.heading);
    const gameTime = useSubmarineStore(state => state.gameTime);

    const ownShip = { x, y, heading };

    const { loadTube, floodTube, equalizeTube, openTube, fireTube } = useSubmarineStore.getState();
    const [selectedTubeId, setSelectedTubeId] = useState<number>(1);

    // Preset State
    const [searchCeiling, setSearchCeiling] = useState(50);
    const [searchFloor, setSearchFloor] = useState(1000);
    const [searchMode, setSearchMode] = useState<'ACTIVE' | 'PASSIVE'>('PASSIVE');

    // Target Selection
    const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

    const selectedTube = tubes.find(t => t.id === selectedTubeId);

    const handleAction = (action: string) => {
        if (!selectedTube) return;

        switch(action) {
            case 'LOAD':
                loadTube(selectedTube.id, {
                    runDepth: 50, // Default run depth
                    floor: searchFloor,
                    ceiling: searchCeiling,
                    searchMode
                });
                break;
            case 'FLOOD':
                floodTube(selectedTube.id);
                break;
            case 'EQUALIZE':
                equalizeTube(selectedTube.id);
                break;
            case 'MUZZLE':
                openTube(selectedTube.id);
                break;
            case 'FIRE':
                {
                    let targetId = undefined;
                    let enableRange = undefined;
                    let gyroAngle = undefined;

                    if (selectedTargetId) {
                        const tracker = trackers.find(t => t.id === selectedTargetId);
                        if (tracker) {
                            targetId = selectedTargetId;
                            const proj = calculateProjectedSolution(tracker.solution, ownShip, gameTime);
                            // RTE: Distance - 1000yds. Minimum 500yds.
                            enableRange = Math.max(500, proj.calcRange - 1000);
                            gyroAngle = proj.calcBearing;
                        }
                    }

                    fireTube(selectedTube.id, targetId, enableRange, gyroAngle);
                }
                break;
        }
    };

    const isActionEnabled = (action: string) => {
        if (!selectedTube) return false;
        switch(action) {
            case 'LOAD': return selectedTube.status === 'EMPTY';
            case 'FLOOD': return selectedTube.status === 'DRY';
            case 'EQUALIZE': return selectedTube.status === 'WET';
            case 'MUZZLE': return selectedTube.status === 'EQUALIZED';
            case 'FIRE': return selectedTube.status === 'OPEN';
            default: return false;
        }
    };

    return (
        <div className="w-full h-full flex flex-col overflow-hidden bg-zinc-900/80 font-mono text-zinc-300 select-none">

            {/* Zone 1: The Tube Bank (Top) */}
            <div className="flex-grow relative border-b-2 border-white/10 p-4">
                 <div className="w-full h-full grid grid-cols-4 gap-2">
                     {tubes.map(tube => (
                         <TubeStrip
                            key={tube.id}
                            tube={tube}
                            isSelected={selectedTubeId === tube.id}
                            onClick={() => setSelectedTubeId(tube.id)}
                         />
                     ))}
                 </div>
                 {/* Label overlay? */}
                 <div className="absolute top-2 right-2 text-xs text-zinc-500 font-bold tracking-widest pointer-events-none opacity-50">TUBE BANK</div>
            </div>

            {/* Zone 2: The Control Deck (Bottom) */}
            <div className="h-64 flex flex-row gap-4 p-4 bg-black/20 flex-shrink-0">

                {/* Left Panel: Presets */}
                <div className="w-2/3 grid grid-cols-2 gap-4">
                     {/* Column 1 */}
                     <div className="flex flex-col gap-4 justify-center">
                         <div className="flex flex-col gap-2">
                             <div className="text-xs text-zinc-500 font-bold tracking-widest">SEARCH CEILING: <span className="text-amber-500">{searchCeiling} FT</span></div>
                             <input
                                 type="range"
                                 min="0"
                                 max="400"
                                 step="10"
                                 value={searchCeiling}
                                 onChange={(e) => setSearchCeiling(Number(e.target.value))}
                                 className="w-full accent-amber-600 cursor-pointer"
                             />
                         </div>
                         <div className="flex flex-col gap-2">
                             <div className="text-xs text-zinc-500 font-bold tracking-widest">SEARCH MODE</div>
                             <div className="flex bg-black/50 rounded p-1 border border-white/10 w-max">
                                 {['PASSIVE', 'ACTIVE'].map(mode => (
                                     <button
                                         key={mode}
                                         onClick={() => setSearchMode(mode as 'ACTIVE' | 'PASSIVE')}
                                         className={`
                                             px-4 py-1 rounded text-xs font-bold transition-colors
                                             ${searchMode === mode ? 'bg-amber-600 text-black' : 'text-zinc-500 hover:text-zinc-300'}
                                         `}
                                     >
                                         {mode}
                                     </button>
                                 ))}
                             </div>
                         </div>
                     </div>

                     {/* Column 2 */}
                     <div className="flex flex-col gap-4 justify-center">
                         <div className="flex flex-col gap-2">
                             <div className="text-xs text-zinc-500 font-bold tracking-widest">SEARCH FLOOR: <span className="text-amber-500">{searchFloor} FT</span></div>
                             <input
                                 type="range"
                                 min="400"
                                 max="1200"
                                 step="10"
                                 value={searchFloor}
                                 onChange={(e) => setSearchFloor(Number(e.target.value))}
                                 className="w-full accent-amber-600 cursor-pointer"
                             />
                         </div>
                         <div className="flex flex-col gap-2">
                            <div className="text-xs text-zinc-500 font-bold tracking-widest">TARGET SELECT</div>
                            <select
                                className="bg-black/50 border border-white/10 rounded text-xs p-1 text-zinc-300 outline-none focus:border-amber-500"
                                value={selectedTargetId || ''}
                                onChange={(e) => setSelectedTargetId(e.target.value || null)}
                            >
                                <option value="">NO TARGET</option>
                                {trackers.map(tracker => (
                                    <option key={tracker.id} value={tracker.id}>
                                        {tracker.id} {tracker.contactId ? `(${tracker.contactId})` : ''}
                                    </option>
                                ))}
                            </select>
                         </div>
                     </div>
                </div>

                {/* Right Panel: Action Keys */}
                <div className="w-1/3 grid grid-cols-2 gap-4">
                     {['LOAD', 'FLOOD', 'EQUALIZE', 'MUZZLE', 'FIRE'].map(action => {
                         const enabled = isActionEnabled(action);
                         return (
                             <button
                                 key={action}
                                 onClick={() => handleAction(action)}
                                 disabled={!enabled}
                                 className={`
                                     border-2 rounded flex items-center justify-center text-sm lg:text-base font-bold tracking-wider transition-all
                                     ${enabled
                                         ? 'border-zinc-500 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:border-zinc-300 shadow-[0_4px_0_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-none'
                                         : 'border-zinc-800 bg-zinc-900/50 text-zinc-700 cursor-not-allowed opacity-50'}
                                 `}
                             >
                                 {action}
                             </button>
                         );
                     })}
                </div>

            </div>

        </div>
    );
};

export default WCSDisplay;

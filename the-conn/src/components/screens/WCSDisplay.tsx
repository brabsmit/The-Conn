import { useState } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import type { Tube, TubeStatus } from '../../store/useSubmarineStore';

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
    <div className={`w-3 h-3 rounded-full border ${color} ${pulse} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
  );
};

const ProgressBar = ({ progress }: { progress: number }) => (
    <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
        <div className="h-full bg-amber-500 transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
    </div>
);

const TubeStrip = ({ tube, isSelected, onClick }: { tube: Tube; isSelected: boolean; onClick: () => void }) => {
    return (
        <div
            onClick={onClick}
            className={`
                w-full h-full p-2 border border-white/10 rounded flex flex-col justify-between cursor-pointer transition-all
                ${isSelected ? 'bg-white/5 border-amber-500/50 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]' : 'bg-black/40 hover:bg-white/5'}
            `}
        >
            <div className="flex justify-between items-center mb-2">
                 <span className={`font-mono text-xl font-bold ${isSelected ? 'text-amber-500' : 'text-zinc-600'}`}>
                     {tube.id}
                 </span>
                 <TubeStatusLight status={tube.status} />
            </div>

            <div className="flex flex-col gap-1">
                <span className={`text-[10px] tracking-wider font-bold ${isSelected ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {tube.status}
                </span>
                {['LOADING', 'FLOODING', 'EQUALIZING', 'OPENING', 'FIRING'].includes(tube.status) && (
                    <ProgressBar progress={tube.progress} />
                )}
            </div>

             <div className="mt-2 text-[10px] text-zinc-500 font-mono">
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
    const { loadTube, floodTube, equalizeTube, openTube } = useSubmarineStore.getState();
    const [selectedTubeId, setSelectedTubeId] = useState<number>(1);

    // Preset State
    const [searchCeiling, setSearchCeiling] = useState(50);
    const [searchFloor, setSearchFloor] = useState(1000);
    const [searchMode, setSearchMode] = useState<'ACTIVE' | 'PASSIVE'>('PASSIVE');

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
        }
    };

    const isActionEnabled = (action: string) => {
        if (!selectedTube) return false;
        switch(action) {
            case 'LOAD': return selectedTube.status === 'EMPTY';
            case 'FLOOD': return selectedTube.status === 'DRY';
            case 'EQUALIZE': return selectedTube.status === 'WET';
            case 'MUZZLE': return selectedTube.status === 'EQUALIZED';
            default: return false;
        }
    };

    return (
        <div className="w-full h-full flex flex-col p-4 bg-zinc-900/80 font-mono text-zinc-300 select-none overflow-y-auto">

            <div className="flex-grow flex gap-4">

                {/* 1. The Tube Bank (Left) */}
                <div className="w-1/4 h-full flex flex-col gap-2">
                     <div className="text-xs text-zinc-500 font-bold tracking-widest mb-1">TUBE BANK</div>
                     <div className="flex-grow grid grid-rows-4 gap-2">
                         {tubes.map(tube => (
                             <TubeStrip
                                key={tube.id}
                                tube={tube}
                                isSelected={selectedTubeId === tube.id}
                                onClick={() => setSelectedTubeId(tube.id)}
                             />
                         ))}
                     </div>
                </div>

                {/* 2. The Master Key (Center) */}
                <div className="w-1/4 h-full flex flex-col items-center justify-center border-x border-white/5 px-4">
                     <div className="mb-8 text-center">
                         <div className="text-xs text-zinc-500 font-bold tracking-widest mb-2">MASTER KEY</div>
                         <div className="w-24 h-24 rounded-full border-4 border-zinc-700 bg-zinc-800 flex items-center justify-center shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                             <span className="text-5xl font-bold text-amber-500 text-shadow-glow">
                                 {selectedTubeId}
                             </span>
                         </div>
                     </div>
                     <div className="text-center text-zinc-500 text-xs">
                         STATUS: <span className="text-zinc-300 font-bold">{selectedTube?.status}</span>
                     </div>
                </div>

                {/* 3. The Action Bank (Right) */}
                <div className="w-1/2 h-full flex flex-col">
                    <div className="text-xs text-zinc-500 font-bold tracking-widest mb-1 text-right">ACTION BANK</div>
                    <div className="flex-grow grid grid-cols-2 gap-4 p-4">
                         {['LOAD', 'FLOOD', 'EQUALIZE', 'MUZZLE'].map(action => {
                             const enabled = isActionEnabled(action);
                             return (
                                 <button
                                     key={action}
                                     onClick={() => handleAction(action)}
                                     disabled={!enabled}
                                     className={`
                                         border-2 rounded flex items-center justify-center text-xl font-bold tracking-wider transition-all
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

            {/* 4. The Presets (Bottom) */}
            <div className="h-1/3 border-t border-white/10 mt-4 pt-4 flex gap-8">
                 <div className="w-1/3 flex flex-col gap-4">
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

                 <div className="w-1/3 flex flex-col gap-4">
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

                 <div className="w-1/3 flex flex-col gap-4 items-center">
                     <div className="text-xs text-zinc-500 font-bold tracking-widest">SEARCH MODE</div>
                     <div className="flex bg-black/50 rounded p-1 border border-white/10">
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

        </div>
    );
};

export default WCSDisplay;

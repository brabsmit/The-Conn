import { useState } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import type { Tube, TubeStatus } from '../../store/useSubmarineStore';
import { calculateProjectedSolution } from '../../lib/tma';

const InterlockLights = ({ status }: { status: TubeStatus }) => {
    // Interlocks: LOADED (Has Weapon), FLOODED (WET+), EQUALIZED (EQUALIZED+), MUZZLE (OPEN+)
    const isLoaded = status !== 'EMPTY' && status !== 'LOADING';
    const isFlooded = ['WET', 'EQUALIZING', 'EQUALIZED', 'OPENING', 'OPEN', 'FIRING'].includes(status);
    const isEqualized = ['EQUALIZED', 'OPENING', 'OPEN', 'FIRING'].includes(status);
    const isOpen = ['OPEN', 'FIRING'].includes(status);

    const Light = ({ on, label }: { on: boolean; label: string }) => (
        <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full border-2 transition-all duration-300 ${on ? 'bg-green-500 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.6)]' : 'bg-zinc-900 border-zinc-700'}`} />
            <span className={`text-[8px] font-bold tracking-wider ${on ? 'text-green-500' : 'text-zinc-600'}`}>{label}</span>
        </div>
    );

    return (
        <div className="flex gap-4 items-center justify-center p-2 bg-black/40 rounded border border-white/5">
            <Light on={isLoaded} label="LOADED" />
            <Light on={isFlooded} label="FLOODED" />
            <Light on={isEqualized} label="EQUALIZED" />
            <Light on={isOpen} label="MUZZLE" />
        </div>
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

const TubeStrip = ({ tube, isSelected, onClick, targetId, onSelectTarget, trackers }: { tube: Tube; isSelected: boolean; onClick: () => void; targetId: string | null; onSelectTarget: (id: string | null) => void; trackers: any[] }) => {
    return (
        <div
            onClick={onClick}
            className={`
                w-full h-full p-2 border border-white/10 rounded flex flex-col justify-between cursor-pointer transition-all overflow-hidden relative
                ${isSelected ? 'bg-white/5 border-amber-500/50 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]' : 'bg-black/40 hover:bg-white/5'}
            `}
        >
            {/* Top: Target Assignment */}
            <div className="w-full flex justify-between items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                 <span className={`font-mono text-xl font-bold flex-shrink-0 ${isSelected ? 'text-amber-500' : 'text-zinc-600'}`}>
                     {tube.id}
                 </span>
                 <select
                    className="bg-black/50 border border-white/10 rounded text-[10px] p-1 text-zinc-300 outline-none focus:border-amber-500 w-full max-w-[120px]"
                    value={targetId || ''}
                    onChange={(e) => onSelectTarget(e.target.value || null)}
                 >
                    <option value="">NO TARGET</option>
                    {trackers.map(tracker => (
                        <option key={tracker.id} value={tracker.id}>
                            {tracker.id} {tracker.classification ? `(${tracker.classification})` : ''}
                        </option>
                    ))}
                 </select>
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
                         {tube.autoSequence && <span className="text-amber-500 animate-pulse">AUTO-SEQ...</span>}
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

    const { loadTube, fireTube } = useSubmarineStore.getState();
    const [selectedTubeId, setSelectedTubeId] = useState<number>(1);

    // Preset State
    const [searchCeiling, setSearchCeiling] = useState(50);
    const [searchFloor, setSearchFloor] = useState(1000);
    const [searchMode, setSearchMode] = useState<'ACTIVE' | 'PASSIVE'>('PASSIVE');

    // Target Selection per Tube (using local state map or store if we want persistence)
    // To keep it simple and fulfill "when user selects a tube... check assigned target", we can map tubeID -> targetID here.
    const [tubeTargets, setTubeTargets] = useState<Record<number, string | null>>({});

    const selectedTube = tubes.find(t => t.id === selectedTubeId);
    const selectedTargetId = selectedTube ? tubeTargets[selectedTube.id] || null : null;

    const handleTargetSelect = (tubeId: number, targetId: string | null) => {
        setTubeTargets(prev => ({ ...prev, [tubeId]: targetId }));
    };

    const handleMakeReady = () => {
        if (!selectedTube) return;

        // If tube is already loaded (DRY/WET/etc), just enable auto-sequence to finish it
        if (selectedTube.status !== 'EMPTY') {
            useSubmarineStore.setState(state => ({
                tubes: state.tubes.map(t =>
                    t.id === selectedTube.id ? { ...t, autoSequence: true } : t
                )
            }));
            return;
        }

        let floor = 1000;
        let ceiling = 50;
        let depth = 50; // Default
        let mode: 'ACTIVE' | 'PASSIVE' = 'PASSIVE';

        if (selectedTargetId) {
            const tracker = trackers.find(t => t.id === selectedTargetId);
            const contact = tracker?.contactId ? useSubmarineStore.getState().contacts.find(c => c.id === tracker.contactId) : null;
            const classification = tracker?.classification || 'UNKNOWN';

            if (classification === 'SUB') {
                depth = contact?.depth || 400; // Use contact depth if available (cheat/simulated crew knowledge)
                floor = 1200; // Deep
                ceiling = 50; // Shallow
            } else if (classification === 'MERCHANT') {
                depth = 20; // Search Depth
                floor = 80;
                ceiling = 0;
            } else {
                // Unknown
                depth = 200;
                floor = 1000;
                ceiling = 50;
            }
        }

        // Apply to UI state as well for feedback
        setSearchFloor(floor);
        setSearchCeiling(ceiling);

        loadTube(selectedTube.id, {
            runDepth: depth,
            floor,
            ceiling,
            searchMode: mode
        });

        // Enable Auto-Sequence
        useSubmarineStore.setState(state => ({
            tubes: state.tubes.map(t =>
                t.id === selectedTube.id ? { ...t, autoSequence: true } : t
            )
        }));
    };

    const handleFire = () => {
        if (!selectedTube || selectedTube.status !== 'OPEN') return;

        let targetId = undefined;
        let enableRange = undefined;
        let gyroAngle = undefined;

        if (selectedTargetId) {
            const tracker = trackers.find(t => t.id === selectedTargetId);
            if (tracker) {
                targetId = selectedTargetId;
                const proj = calculateProjectedSolution(tracker.solution, ownShip, gameTime);
                enableRange = Math.max(500, proj.calcRange - 1000);
                gyroAngle = proj.calcBearing;
            }
        }

        fireTube(selectedTube.id, targetId, enableRange, gyroAngle);
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
                            targetId={tubeTargets[tube.id] || null}
                            onSelectTarget={(id) => handleTargetSelect(tube.id, id)}
                            trackers={trackers}
                         />
                     ))}
                 </div>
                 {/* Label overlay? */}
                 <div className="absolute top-2 right-2 text-xs text-zinc-500 font-bold tracking-widest pointer-events-none opacity-50">TUBE BANK</div>
            </div>

            {/* Zone 2: The Control Deck (Bottom) */}
            <div className="h-64 flex flex-row gap-4 p-4 bg-black/20 flex-shrink-0">

                {/* Left Panel: Presets & Interlocks Display */}
                <div className="w-2/3 flex flex-col gap-4">

                     <div className="flex gap-4 h-full">
                         {/* Presets Controls */}
                         <div className="flex-grow grid grid-cols-2 gap-4">
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
                             </div>
                         </div>
                     </div>

                     {/* Interlock Lights Row */}
                     <div className="mt-auto">
                        <div className="text-xs text-zinc-500 font-bold tracking-widest mb-1">INTERLOCKS</div>
                        {selectedTube && <InterlockLights status={selectedTube.status} />}
                     </div>
                </div>

                {/* Right Panel: Action Keys */}
                <div className="w-1/3 flex flex-col gap-4">
                    {/* Make Ready Button */}
                    <button
                        onClick={handleMakeReady}
                        disabled={!selectedTube || ['OPEN', 'FIRING'].includes(selectedTube.status)}
                        className={`
                            flex-1 border-2 rounded flex flex-col items-center justify-center transition-all
                            ${selectedTube && !['OPEN', 'FIRING'].includes(selectedTube.status)
                                ? 'border-amber-500 bg-amber-900/40 text-amber-100 hover:bg-amber-900/60 shadow-[0_4px_0_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-none'
                                : 'border-zinc-800 bg-zinc-900/50 text-zinc-700 cursor-not-allowed opacity-50'}
                        `}
                    >
                        <span className="font-bold text-lg tracking-wider">MAKE READY</span>
                        <span className="text-[10px] opacity-75">AUTO-LOAD & SEQUENCE</span>
                    </button>

                    {/* Fire Button */}
                    <button
                        onClick={handleFire}
                        disabled={!selectedTube || selectedTube.status !== 'OPEN'}
                        className={`
                            h-20 border-2 rounded flex items-center justify-center transition-all
                            ${selectedTube?.status === 'OPEN'
                                ? 'border-red-500 bg-red-600 text-white shadow-[0_4px_0_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-none animate-pulse'
                                : 'border-zinc-800 bg-zinc-900/50 text-zinc-700 cursor-not-allowed opacity-50'}
                        `}
                    >
                         <span className="font-bold text-2xl tracking-widest">FIRE</span>
                    </button>
                </div>

            </div>

        </div>
    );
};

export default WCSDisplay;

import { useSubmarineStore } from '../../store/useSubmarineStore';

export const DebriefModal: React.FC = () => {
    const gameState = useSubmarineStore(state => state.gameState);
    const resetSimulation = useSubmarineStore(state => state.resetSimulation);
    const setAppState = useSubmarineStore(state => state.setAppState);
    const ownShipHistory = useSubmarineStore(state => state.ownShipHistory);
    const contacts = useSubmarineStore(state => state.contacts);
    const torpedoes = useSubmarineStore(state => state.torpedoes);
    const metrics = useSubmarineStore(state => state.metrics);

    // Initial Ownship Start position (first history point or current if empty)
    const startX = ownShipHistory[0]?.x || 0;
    const startY = ownShipHistory[0]?.y || 0;

    // Canvas Settings
    const CANVAS_SIZE = 800;

    // Helper: World (ft) -> Screen (px)
    // Centered on 0,0 relative to Start Position? Or just center on the action?
    // Let's Center on the average of all history? Or just fixed "Game Box"?
    // The ScenarioManager centers on Ownship. Here we want to see the whole history.
    // Let's center on the middle of the ownship track.

    // Find bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    const updateBounds = (x: number, y: number) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    };

    ownShipHistory.forEach(p => updateBounds(p.x, p.y));
    contacts.forEach(c => c.history?.forEach(p => updateBounds(p.x, p.y)));
    // Also include current positions
    updateBounds(startX, startY);
    contacts.forEach(c => updateBounds(c.x, c.y));

    // Default bounds if empty
    if (minX === Infinity) { minX = -10000; maxX = 10000; minY = -10000; maxY = 10000; }

    // Add padding
    const padding = 5000; // ft
    minX -= padding; maxX += padding; minY -= padding; maxY += padding;

    const mapWidth = maxX - minX;
    const mapHeight = maxY - minY;

    // Scale to fit
    const scaleX = CANVAS_SIZE / mapWidth;
    const scaleY = CANVAS_SIZE / mapHeight;
    const scale = Math.min(scaleX, scaleY);

    const worldToScreen = (wx: number, wy: number) => {
        const relX = wx - minX;
        // World +Y is North (Up). Screen +Y is Down.
        // So we flip Y.
        // maxY corresponds to Screen Y=0.
        // minY corresponds to Screen Y=Height.

        return {
            x: relX * scale,
            y: (maxY - wy) * scale
        };
    };

    // Generate Path Strings
    const createPath = (history: {x: number, y: number}[]) => {
        if (!history || history.length === 0) return '';
        const start = worldToScreen(history[0].x, history[0].y);
        let d = `M ${start.x} ${start.y}`;
        for (let i = 1; i < history.length; i++) {
            const p = worldToScreen(history[i].x, history[i].y);
            d += ` L ${p.x} ${p.y}`;
        }
        return d;
    };

    const handleExit = () => {
        setAppState('MENU');
        resetSimulation();
    };

    if (gameState === 'RUNNING') return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-500 overflow-y-auto p-8">
            <h1 className={`text-6xl font-black tracking-tighter mb-4 ${gameState === 'VICTORY' ? 'text-green-500' : 'text-red-600'}`}>
                {gameState === 'VICTORY' ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}
            </h1>

            {/* METRICS PANEL */}
            <div className="grid grid-cols-3 gap-8 mb-8 w-full max-w-4xl">
                 <div className="bg-zinc-900 border border-zinc-700 p-4 rounded text-center">
                     <div className="text-zinc-500 text-sm font-bold uppercase tracking-wider mb-2">Safety (Min Range)</div>
                     <div className={`text-3xl font-mono ${metrics.minRangeToContact < 2000 ? 'text-red-500' : 'text-green-500'}`}>
                         {metrics.minRangeToContact === Infinity ? '-' : Math.round(metrics.minRangeToContact)} yds
                     </div>
                 </div>
                 <div className="bg-zinc-900 border border-zinc-700 p-4 rounded text-center">
                     <div className="text-zinc-500 text-sm font-bold uppercase tracking-wider mb-2">Stealth (Exposure)</div>
                     <div className={`text-3xl font-mono ${metrics.counterDetectionTime > 0 ? 'text-red-500' : 'text-green-500'}`}>
                         {Math.round(metrics.counterDetectionTime)} sec
                     </div>
                 </div>
                 <div className="bg-zinc-900 border border-zinc-700 p-4 rounded text-center">
                     <div className="text-zinc-500 text-sm font-bold uppercase tracking-wider mb-2">Accuracy (Avg Err)</div>
                     <div className="text-3xl font-mono text-cyan-500">
                         {metrics.tmaErrorCount > 0
                             ? Math.round(metrics.tmaErrorAccumulator / metrics.tmaErrorCount)
                             : '-'} yds
                     </div>
                 </div>
            </div>

            {/* MAP */}
            <div className="bg-zinc-900 border-2 border-zinc-700 rounded-lg shadow-2xl overflow-hidden relative mb-8" style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
                 <svg width={CANVAS_SIZE} height={CANVAS_SIZE} className="bg-[#000810]">
                     {/* Grid Lines */}
                     <defs>
                         <pattern id="grid" width={100} height={100} patternUnits="userSpaceOnUse">
                             <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#112233" strokeWidth="1"/>
                         </pattern>
                     </defs>
                     <rect width="100%" height="100%" fill="url(#grid)" />

                     {/* OWNSHIP TRACK */}
                     <path d={createPath(ownShipHistory)} fill="none" stroke="#00FFFF" strokeWidth="2" opacity="0.8" />
                     {/* End Point */}
                     {ownShipHistory.length > 0 && (() => {
                         const last = ownShipHistory[ownShipHistory.length-1];
                         const p = worldToScreen(last.x, last.y);
                         return <circle cx={p.x} cy={p.y} r="4" fill="#00FFFF" />;
                     })()}

                     {/* ENEMY TRACKS */}
                     {contacts.map(c => (
                         <g key={c.id}>
                             <path d={createPath(c.history || [])} fill="none" stroke={c.type === 'ENEMY' ? '#FF0000' : '#00FF00'} strokeWidth="2" opacity="0.8" strokeDasharray="4 2" />
                             {/* Current Pos */}
                             {(() => {
                                 const p = worldToScreen(c.x, c.y);
                                 return (
                                    <g transform={`translate(${p.x}, ${p.y})`}>
                                        <rect x="-3" y="-3" width="6" height="6" fill={c.type === 'ENEMY' ? '#FF0000' : '#00FF00'} />
                                        <text y="-5" fill="white" fontSize="10" textAnchor="middle">{c.classification}</text>
                                    </g>
                                 );
                             })()}
                         </g>
                     ))}

                     {/* TORPEDO TRACKS */}
                     {torpedoes.map(t => (
                         <g key={t.id}>
                             <path d={createPath(t.history || [])} fill="none" stroke="#FFFF00" strokeWidth="1" opacity="0.6" />
                             {/* Impact/End */}
                             {t.history && t.history.length > 0 && (() => {
                                 const last = t.history[t.history.length-1];
                                 const p = worldToScreen(last.x, last.y);
                                 return <circle cx={p.x} cy={p.y} r="2" fill="#FFFF00" />;
                             })()}
                         </g>
                     ))}
                 </svg>

                 <div className="absolute top-4 left-4 text-white/50 font-mono text-xs">
                     <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-cyan-400"></div> OWNSHIP</div>
                     <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-red-500 border-dashed border-t"></div> HOSTILE</div>
                     <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-yellow-400"></div> WEAPON</div>
                 </div>
            </div>

            <div className="flex gap-4">
                <button
                    onClick={() => handleExit()}
                    className="px-8 py-3 bg-white text-black font-bold text-lg rounded hover:bg-gray-200 transition-colors uppercase tracking-widest"
                >
                    Return to Lobby
                </button>
            </div>
        </div>
    );
};

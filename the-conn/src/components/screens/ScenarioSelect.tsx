import React from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { scenarios } from '../../scenarios';

export const ScenarioSelect: React.FC = () => {
    const loadScenario = useSubmarineStore(state => state.loadScenario);
    const setExpertMode = useSubmarineStore(state => state.setExpertMode);

    // Always force Expert Mode for these scenarios as per requirement
    // But maybe allow toggle for dev? No, req says "Expert Mode is forced ON".
    const handleSelect = (scenario: any) => {
        loadScenario(scenario.setup(), scenario.id);
        setExpertMode(true);
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-black text-cyan-500 font-mono p-10 bg-grid-pattern">
            <h1 className="text-6xl font-bold mb-2 tracking-widest text-white border-b-4 border-cyan-500 pb-4">
                SUB COMMAND
            </h1>
            <h2 className="text-xl text-cyan-700 mb-12 uppercase tracking-[0.5em]">Tactical Simulator</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
                {scenarios.map(sc => (
                    <button
                        key={sc.id}
                        onClick={() => handleSelect(sc)}
                        className="group relative flex flex-col items-start p-6 border border-cyan-900 bg-zinc-900/50 hover:bg-cyan-900/20 hover:border-cyan-500 transition-all duration-300 text-left"
                    >
                         <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-100 transition-opacity">
                             <div className="w-2 h-2 bg-cyan-500 rounded-full animate-ping"></div>
                         </div>
                         <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-300">{sc.title}</h3>
                         <p className="text-sm text-cyan-600/80 group-hover:text-cyan-400">{sc.description}</p>
                    </button>
                ))}
            </div>

            <div className="mt-12 text-xs text-cyan-900">
                SYSTEM READY. RESTRICTED ACCESS.
            </div>
        </div>
    );
};

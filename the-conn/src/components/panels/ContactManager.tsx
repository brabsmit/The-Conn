import { useState } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { useInterval } from '../../hooks/useInterval';

export const ContactManager = () => {
    const [trackers, setTrackers] = useState(() => {
        const state = useSubmarineStore.getState();
        return state.trackers.filter(t => {
            const c = state.contacts.find(c => c.id === t.contactId);
            return !c || c.status !== 'DESTROYED';
        });
    });

    // Poll for tracker updates every 1000ms (1Hz) to stabilize UI values
    useInterval(() => {
        const state = useSubmarineStore.getState();
        const active = state.trackers.filter(t => {
            if (t.kind === 'WEAPON') return true;
            const c = state.contacts.find(c => c.id === t.contactId);
            return !c || c.status !== 'DESTROYED';
        });
        setTrackers(active);
    }, 1000);

    const selectedTrackerId = useSubmarineStore((state) => state.selectedTrackerId);
    const heading = useSubmarineStore((state) => state.heading);
    const setSelectedTracker = useSubmarineStore((state) => state.setSelectedTracker);
    const deleteTracker = useSubmarineStore((state) => state.deleteTracker);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-black/80 font-mono text-xs">
            {/* Header */}
            <div className="flex items-center px-2 py-1 bg-white/5 border-b border-white/10 text-zinc-500 font-bold uppercase tracking-wider">
                <div className="w-12 text-center">ID</div>
                <div className="w-16 text-center">TRUE BRG</div>
                <div className="flex-grow text-center">CLASS</div>
                <div className="w-8"></div>
            </div>

            {/* List */}
            <div className="flex-grow overflow-y-auto">
                {trackers.length === 0 ? (
                    <div className="p-4 text-center text-zinc-600 italic">No Active Contacts</div>
                ) : (
                    trackers.map((tracker) => {
                        const isSelected = selectedTrackerId === tracker.id;
                        const isSub = tracker.classification === 'SUB';
                        const isWeapon = tracker.kind === 'WEAPON';

                        return (
                            <div
                                key={tracker.id}
                                onClick={() => setSelectedTracker(tracker.id)}
                                className={`flex items-center px-2 py-2 border-b border-white/5 cursor-pointer transition-colors ${
                                    isSub ? 'animate-pulse bg-red-900/40 border-red-900/50' :
                                    isWeapon ? 'bg-red-900/60 border-red-500 text-red-100 animate-pulse' :
                                    isSelected
                                        ? 'bg-amber-900/30 text-amber-200'
                                        : 'hover:bg-white/5 text-zinc-400'
                                }`}
                            >
                                {/* ID */}
                                <div className={`w-12 font-bold text-center flex items-center justify-center ${isSelected ? 'text-amber-400' : isSub ? 'text-red-500' : 'text-zinc-500'}`}>
                                    {isSub && <span className="mr-1 text-red-500">⚠</span>}
                                    {isWeapon && <span className="mr-1 text-red-500">🚀</span>}
                                    {tracker.id}
                                </div>

                                {/* Bearing */}
                                <div className={`w-16 text-center tabular-nums font-mono ${isSub || isWeapon ? 'text-red-200' : 'text-zinc-300'}`}>
                                    {((tracker.currentBearing + heading) % 360).toFixed(0).padStart(3, '0')}
                                </div>

                                {/* Class */}
                                <div className={`flex-grow text-center font-bold ${
                                    tracker.classificationStatus === 'PENDING' ? 'text-zinc-600 italic font-normal' :
                                    tracker.classification === 'MERCHANT' ? 'text-blue-400' :
                                    tracker.classification === 'ESCORT' ? 'text-red-400' :
                                    tracker.classification === 'SUB' ? 'text-red-500' :
                                    tracker.classification === 'TORPEDO' ? 'text-red-500 font-black' :
                                    'text-green-400'
                                }`}>
                                    {tracker.classificationStatus === 'PENDING' ? 'PENDING...' : tracker.classification || 'UNKNOWN'}
                                </div>

                                {/* Actions */}
                                <div className="w-8 flex justify-center">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteTracker(tracker.id);
                                        }}
                                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-900/50 hover:text-red-400 text-zinc-600 transition-colors"
                                        title="Drop Contact"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

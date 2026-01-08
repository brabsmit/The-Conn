import { useState, useRef, useEffect, memo } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';
import { useInterval } from '../../hooks/useInterval';
import type { Tracker } from '../../store/useSubmarineStore';

interface ContactListRowProps {
    tracker: Tracker;
    isSelected: boolean;
    setSelectedTracker: (id: string) => void;
    deleteTracker: (id: string) => void;
}

const ContactListRow = memo(({ tracker, isSelected, setSelectedTracker, deleteTracker }: ContactListRowProps) => {
    const bearingRef = useRef<HTMLDivElement>(null);
    const lastUpdateRef = useRef<number>(0);

    const isSub = tracker.classification === 'SUB';
    const isWeapon = tracker.kind === 'WEAPON';

    // Initial heading for first render
    const initialHeading = useSubmarineStore.getState().heading;
    const initialBearing = ((tracker.currentBearing + initialHeading) % 360).toFixed(0).padStart(3, '0');

    useEffect(() => {
        const unsub = useSubmarineStore.subscribe((state) => {
            const now = Date.now();
            if (now - lastUpdateRef.current < 100) return; // 10Hz throttle

            const currentTracker = state.trackers.find(t => t.id === tracker.id);
            if (currentTracker && bearingRef.current) {
                const currentHeading = state.heading;
                const bearing = ((currentTracker.currentBearing + currentHeading) % 360).toFixed(0).padStart(3, '0');
                if (bearingRef.current.innerText !== bearing) {
                     bearingRef.current.innerText = bearing;
                }
                lastUpdateRef.current = now;
            }
        });
        return unsub;
    }, [tracker.id]);

    return (
        <div
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

            {/* Bearing - Optimized Update */}
            <div
                ref={bearingRef}
                className={`w-16 text-center tabular-nums font-mono ${isSub || isWeapon ? 'text-red-200' : 'text-zinc-300'}`}
            >
                {initialBearing}
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
});

export const ContactManager = () => {
    // Restore Poll-based List Update (1Hz) to prevent list thrashing
    const [trackers, setTrackers] = useState<Tracker[]>(() => {
        const state = useSubmarineStore.getState();
        return state.trackers.filter(t => {
            const c = state.contacts.find(c => c.id === t.contactId);
            return !c || c.status !== 'DESTROYED';
        });
    });

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
                    trackers.map((tracker) => (
                        <ContactListRow
                            key={tracker.id}
                            tracker={tracker}
                            isSelected={selectedTrackerId === tracker.id}
                            setSelectedTracker={setSelectedTracker}
                            deleteTracker={deleteTracker}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

import { useEffect, useRef } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface LogHistoryProps {
  onClose: () => void;
}

export const LogHistory = ({ onClose }: LogHistoryProps) => {
  const logs = useSubmarineStore(state => state.logs);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Sort logs by time descending (newest first)
  const sortedLogs = [...logs].reverse();

  return (
    <div
        ref={ref}
        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[500px] max-h-64 overflow-y-auto bg-black/90 backdrop-blur-sm border border-zinc-700 rounded shadow-2xl z-50 flex flex-col font-mono text-xs"
    >
      {logs.length === 0 && (
          <div className="p-4 text-zinc-500 text-center italic">No messages</div>
      )}
      {sortedLogs.map((log, i) => (
        <div key={i} className="px-3 py-1 border-b border-white/5 hover:bg-white/5 text-zinc-300 flex">
           <span className="text-zinc-500 mr-2 shrink-0">[{formatTime(log.timestamp)}]</span>
           <span className={
               log.type === 'ALERT' ? 'text-red-500 font-bold' :
               log.message.includes('MERCHANT') ? 'text-green-400' : 'text-amber-400'
           }>
             {log.message}
           </span>
        </div>
      ))}
    </div>
  );
};

import { useSubmarineStore } from '../../store/useSubmarineStore';

export const MessageLog = () => {
  const logs = useSubmarineStore((state) => state.logs);

  if (logs.length === 0) return null;

  // Show last 5 logs
  const displayLogs = logs.slice(-5);

  return (
    <div className="absolute bottom-4 left-4 z-50 pointer-events-none">
       <div className="flex flex-col gap-1 items-start">
         {displayLogs.map((log, index) => (
            <div
                key={index}
                className="bg-black/80 text-amber-500 font-mono text-[10px] px-2 py-1 rounded border border-amber-900/30 shadow-lg animate-fade-in"
            >
                {log}
            </div>
         ))}
       </div>
    </div>
  );
};

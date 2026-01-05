import { useSubmarineStore } from '../../store/useSubmarineStore';

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const TopBar = () => {
  const {
    gameTime,
    heading,
    orderedHeading,
    speed,
    depth
  } = useSubmarineStore();

  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-bulkhead bg-noise z-50 border-b border-white/10 shadow-lg flex items-center px-6 font-mono text-zinc-300 select-none">

      {/* TIME */}
      <div className="flex flex-col mr-8">
        <span className="text-[10px] text-zinc-500 leading-none mb-1">SIM TIME</span>
        <span className="text-xl text-amber-500 tracking-wider">
          {formatTime(gameTime)}
        </span>
      </div>

      {/* COURSE / HEADING */}
      <div className="flex items-center mr-8 gap-4 border-l border-white/5 pl-6 h-full py-2">
        <div className="flex flex-col items-end">
           <span className="text-[10px] text-zinc-500 leading-none mb-1">CSE</span>
           <span className="text-sm text-zinc-400">
             {Math.round(orderedHeading).toString().padStart(3, '0')}°
           </span>
        </div>
        <div className="flex flex-col">
           <span className="text-[10px] text-zinc-500 leading-none mb-1">HDG</span>
           <span className="text-2xl text-white font-bold tracking-widest">
             {Math.round(heading).toString().padStart(3, '0')}°
           </span>
        </div>
      </div>

      {/* SPEED */}
      <div className="flex flex-col mr-8 border-l border-white/5 pl-6 h-full justify-center">
         <div className="flex items-baseline gap-1">
            <span className="text-2xl text-white font-bold">
              {speed.toFixed(1)}
            </span>
            <span className="text-xs text-zinc-500">KTS</span>
         </div>
         <span className="text-[10px] text-zinc-500 leading-none">SPEED</span>
      </div>

      {/* DEPTH */}
      <div className="flex flex-col mr-8 border-l border-white/5 pl-6 h-full justify-center">
         <div className="flex items-baseline gap-1">
            <span className="text-2xl text-white font-bold">
              {Math.round(depth).toString().padStart(4, '0')}
            </span>
            <span className="text-xs text-zinc-500">FT</span>
         </div>
         <span className="text-[10px] text-zinc-500 leading-none">DEPTH</span>
      </div>

    </div>
  );
};

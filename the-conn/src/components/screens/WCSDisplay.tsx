import React from 'react';

const WCSDisplay: React.FC = () => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 font-mono">
      <div className="text-4xl font-bold tracking-widest animate-pulse opacity-50">
        WCS STANDBY
      </div>
      <div className="mt-4 text-xs tracking-wider">
        WEAPONS CONTROL SYSTEM
      </div>
      <div className="mt-2 text-xs text-alert">
        OFFLINE
      </div>
    </div>
  );
};

export default WCSDisplay;

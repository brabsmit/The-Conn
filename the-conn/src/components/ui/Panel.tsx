import React from 'react';

interface PanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'danger';
  headerRight?: React.ReactNode;
  style?: React.CSSProperties;
  noPadding?: boolean;
}

export const Panel: React.FC<PanelProps> = ({ title, children, className = '', variant = 'default', headerRight, style, noPadding = false }) => {
  const borderColor = variant === 'danger' ? 'border-alert/50' : 'border-panel-border';

  return (
    <div className={`relative flex flex-col bg-panel-bg border-2 ${borderColor} rounded-sm shadow-hard ${className}`} style={style}>
      {/* The "Texture" Overlay */}
      <div className="absolute inset-0 bg-noise pointer-events-none opacity-50" />

      {/* The Mounting Bolts (Visual Candy) */}
      <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-zinc-700 shadow-inner" />
      <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-zinc-700 shadow-inner" />
      <div className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-zinc-700 shadow-inner" />
      <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-zinc-700 shadow-inner" />

      {/* The Header Plate */}
      <div className="relative z-10 px-4 py-1 border-b-2 border-panel-border bg-black/20 text-center flex justify-center items-center">
        <h2 className="text-xs font-mono font-bold tracking-widest text-zinc-400 uppercase">
          {title}
        </h2>
        {headerRight && (
          <div className="absolute right-2 top-0 bottom-0 flex items-center">
            {headerRight}
          </div>
        )}
      </div>

      {/* The Content Area */}
      <div className={`relative z-10 flex-1 flex flex-col min-h-0 ${noPadding ? '' : 'p-4'}`}>
        {children}
      </div>
    </div>
  );
};
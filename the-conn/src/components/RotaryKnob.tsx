import React, { useState, useRef, useEffect, useCallback } from 'react';

interface RotaryKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  sensitivity?: number;
  onChange: (value: number) => void;
  format?: (val: number) => string;
  unit?: string;
  size?: 'small' | 'large';
  loop?: boolean; // For 0-360 wrapping
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  sensitivity = 0.5,
  onChange,
  format,
  unit,
  size = 'large',
  loop = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number>(0);
  const startX = useRef<number>(0);
  const startVal = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startX.current = e.clientX;
    startVal.current = value;
    document.body.style.cursor = 'ns-resize';
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const dy = startY.current - e.clientY; // Up is positive
    const dx = e.clientX - startX.current; // Right is positive

    // Combine both for diagonal feel, or just use one. Prompt says "Drag Up/Right: Increase".
    const delta = (dy + dx) * sensitivity;

    // Apply step
    // We want smooth dragging but snapped output? Or smooth output?
    // "Pixel-perfect precision" suggests we might want fine control.
    // Let's accumulate delta and snap to step.

    let newValue = startVal.current + delta;

    if (loop) {
        // Wrap
        const range = max - min; // usually 360 - 0 = 360.
        // Logic: if value goes > max, wrap to min.
        // Actually typical knob behavior for 360 is wrapping.
        // normalized = (val - min) % range + min
        // But let's keep it simple.
        while (newValue >= max) newValue -= (max - min);
        while (newValue < min) newValue += (max - min);
    } else {
        // Clamp
        newValue = Math.max(min, Math.min(max, newValue));
    }

    // Round to step
    if (step > 0) {
        newValue = Math.round(newValue / step) * step;
    }

    onChange(newValue);
  }, [isDragging, sensitivity, loop, max, min, onChange, step]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Visuals
  // Ring: SVG circle with stroke-dasharray based on percentage
  const percentage = loop
    ? (value / max)
    : ((value - min) / (max - min));

  // Large: 120px, Small: 80px
  const dim = size === 'large' ? 120 : 80;
  const strokeWidth = size === 'large' ? 6 : 4;
  const radius = (dim - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage * circumference);

  // Color logic based on active interaction
  const ringColor = isDragging ? 'stroke-green-400' : 'stroke-green-600/60';
  const textColor = isDragging ? 'text-green-300' : 'text-green-500';

  return (
    <div
        className={`relative flex flex-col items-center justify-center select-none cursor-ns-resize group ${size === 'large' ? 'w-[120px]' : 'w-[80px]'}`}
        onMouseDown={handleMouseDown}
    >
        {/* SVG Ring */}
        <svg width={dim} height={dim} className="rotate-[-90deg]">
            {/* Background Track */}
            <circle
                cx={dim/2}
                cy={dim/2}
                r={radius}
                fill="transparent"
                className="stroke-white/10"
                strokeWidth={strokeWidth}
            />
            {/* Value Indicator */}
            <circle
                cx={dim/2}
                cy={dim/2}
                r={radius}
                fill="transparent"
                className={`${ringColor} transition-colors duration-100`}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
            />
        </svg>

        {/* Center Value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
             <span className={`font-mono font-bold ${size === 'large' ? 'text-2xl' : 'text-lg'} ${textColor}`}>
                 {format ? format(value) : value.toFixed(step < 1 ? 1 : 0)}
             </span>
             {unit && <span className="text-[10px] text-zinc-500">{unit}</span>}
        </div>

        {/* Label */}
        <div className="absolute -bottom-6 w-full text-center text-[10px] text-zinc-400 font-bold tracking-widest uppercase">
            {label}
        </div>
    </div>
  );
};

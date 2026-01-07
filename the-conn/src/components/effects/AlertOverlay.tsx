import { useEffect, useState } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';

export const AlertOverlay = () => {
  const alertLevel = useSubmarineStore(state => state.alertLevel);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (alertLevel === 'COMBAT') {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 500); // 0.5s flash
      return () => clearTimeout(timer);
    }
  }, [alertLevel]);

  if (alertLevel === 'NORMAL') return null;

  return (
    <>
      {/* Flash Effect (Transition) */}
      <div
        className={`fixed inset-0 pointer-events-none z-[100] bg-red-600 transition-opacity duration-500 ease-out mix-blend-overlay ${
          flash ? 'opacity-80' : 'opacity-0'
        }`}
      />

      {/* Persistent Vignette (State) */}
      <div
        className="fixed inset-0 pointer-events-none z-[90] opacity-40 mix-blend-multiply"
        style={{
          background: 'radial-gradient(circle, transparent 40%, #ff0000 100%)'
        }}
      />

      {/* Red Tint */}
       <div
        className="fixed inset-0 pointer-events-none z-[90] bg-red-900/10 mix-blend-overlay"
      />
    </>
  );
};

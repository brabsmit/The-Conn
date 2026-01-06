import React, { useState, useRef, useEffect } from 'react';
import { useSubmarineStore } from '../../store/useSubmarineStore';

interface ScenarioManagerProps {
  onClose: () => void;
}

export const ScenarioManager: React.FC<ScenarioManagerProps> = ({ onClose }) => {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Store access
  const ownShipX = useSubmarineStore(state => state.x);
  const ownShipY = useSubmarineStore(state => state.y);
  const ownShipHeading = useSubmarineStore(state => state.heading);
  const ownShipSpeed = useSubmarineStore(state => state.speed);

  const ownShip = { x: ownShipX, y: ownShipY, heading: ownShipHeading, speed: ownShipSpeed };

  const contacts = useSubmarineStore(state => state.contacts);
  const torpedoes = useSubmarineStore(state => state.torpedoes);

  const addContact = useSubmarineStore(state => state.addContact);
  const updateContact = useSubmarineStore(state => state.updateContact);
  const removeContact = useSubmarineStore(state => state.removeContact);

  // Sidebar form state
  const [formData, setFormData] = useState({
    range: 10000,
    bearing: 0,
    heading: 90,
    speed: 10,
    type: 'ENEMY' as 'ENEMY' | 'NEUTRAL'
  });

  const handleSelect = (id: string, type: 'CONTACT' | 'OWNSHIP') => {
      setSelectedEntityId(id);
      if (type === 'CONTACT') {
          const contact = contacts.find(c => c.id === id);
          if (contact) {
              // Calculate Range/Bearing from Ownship
              const dx = contact.x - ownShip.x;
              const dy = contact.y - ownShip.y;
              const range = Math.sqrt(dx*dx + dy*dy) / 3; // yards
              const mathAngle = Math.atan2(dy, dx) * (180/Math.PI);
              let bearing = (90 - mathAngle + 360) % 360; // True bearing

              setFormData({
                  range: Math.round(range),
                  bearing: Math.round(bearing),
                  heading: contact.heading ?? 0,
                  speed: contact.speed ?? 0,
                  type: contact.type || 'ENEMY'
              });
          }
      }
  };

  const handleUpdate = () => {
      if (!selectedEntityId) return;

      // Calculate new X/Y based on Range/Bearing from Ownship
      const rangeFt = formData.range * 3;
      const radBearing = (formData.bearing * Math.PI) / 180;
      // Bearing 0 is North (+Y), 90 is East (+X)
      // x = ownShip.x + r * sin(theta)
      // y = ownShip.y + r * cos(theta)
      const newX = ownShip.x + rangeFt * Math.sin(radBearing);
      const newY = ownShip.y + rangeFt * Math.cos(radBearing);

      updateContact(selectedEntityId, {
          x: newX,
          y: newY,
          heading: formData.heading,
          speed: formData.speed,
          type: formData.type
      });
  };

  const handleCreate = () => {
      const id = `S-${Date.now()}`;
      // Default: 10k yards, Brg 000
      const rangeFt = 10000 * 3;
      const newX = ownShip.x; // + 0 * sin(0)
      const newY = ownShip.y + rangeFt; // + range * cos(0)

      addContact({
          id,
          x: newX,
          y: newY,
          heading: 270,
          speed: 5,
          type: 'ENEMY'
      });
      handleSelect(id, 'CONTACT');
  };

  const handleDelete = () => {
      if (selectedEntityId) {
          removeContact(selectedEntityId);
          setSelectedEntityId(null);
      }
  };

  // Map Rendering
  const CANVAS_SIZE = 600;
  const SCALE = 0.05; // pixels per foot? No, that's too zoom.
  // View range: let's say +/- 20,000 yards
  // 20,000 yds = 60,000 ft.
  // 600 px / 120,000 ft = 0.005 px/ft
  const PX_PER_FT = 600 / (40000 * 3); // 40k yards total width

  const worldToScreen = (wx: number, wy: number) => {
      // Center on Ownship
      const relX = wx - ownShip.x;
      const relY = wy - ownShip.y;

      // Screen Center
      const cx = CANVAS_SIZE / 2;
      const cy = CANVAS_SIZE / 2;

      // In screen coords: +x is right, +y is down.
      // In world: +x is East (Right), +y is North (Up).
      // So world Y needs to be inverted for screen.

      return {
          x: cx + relX * PX_PER_FT,
          y: cy - relY * PX_PER_FT
      };
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 w-[900px] h-[700px] flex shadow-2xl rounded-lg overflow-hidden">

        {/* MAP */}
        <div className="w-[600px] h-full bg-black relative border-r border-zinc-800 cursor-crosshair">
            <svg width={CANVAS_SIZE} height={CANVAS_SIZE} className="absolute inset-0">
                {/* Grid Rings (5k, 10k, 15k) */}
                {[5000, 10000, 15000, 20000].map(r => (
                    <circle
                        key={r}
                        cx={CANVAS_SIZE/2}
                        cy={CANVAS_SIZE/2}
                        r={r * 3 * PX_PER_FT}
                        fill="none"
                        stroke="#333"
                        strokeDasharray="4 4"
                    />
                ))}

                {/* Ownship */}
                <g transform={`translate(${CANVAS_SIZE/2}, ${CANVAS_SIZE/2}) rotate(${ownShip.heading})`}>
                    <path d="M0 -10 L7 10 L0 5 L-7 10 Z" fill="cyan" stroke="blue" />
                    {/* Velocity Vector */}
                    <line x1="0" y1="0" x2="0" y2={-ownShip.speed * 5} stroke="cyan" strokeWidth="2" opacity="0.5" />
                </g>

                {/* Contacts */}
                {contacts.map(c => {
                    const pos = worldToScreen(c.x, c.y);
                    const isSelected = selectedEntityId === c.id;
                    const isNeutral = c.type === 'NEUTRAL';
                    const color = isNeutral ? 'lime' : 'red';
                    const fillColor = isNeutral ? '#060' : '#600';

                    return (
                        <g
                            key={c.id}
                            transform={`translate(${pos.x}, ${pos.y})`}
                            onClick={() => handleSelect(c.id, 'CONTACT')}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                        >
                            {isNeutral ? (
                                <circle r="6" fill={isSelected ? color : fillColor} stroke={color} strokeWidth={isSelected ? 2 : 1} />
                            ) : (
                                <rect x="-6" y="-6" width="12" height="12" fill={isSelected ? color : fillColor} stroke={color} strokeWidth={isSelected ? 2 : 1} />
                            )}

                            <text y="-10" fill={color} fontSize="10" textAnchor="middle">{c.id}</text>

                            {/* Heading Vector */}
                            {c.heading !== undefined && (
                                <g transform={`rotate(${c.heading})`}>
                                     <line x1="0" y1="0" x2="0" y2={-(c.speed || 0) * 5} stroke={color} strokeWidth="2" />
                                </g>
                            )}
                        </g>
                    );
                })}

                {/* Torpedoes */}
                {torpedoes.map(t => {
                    const pos = worldToScreen(t.position.x, t.position.y);
                     return (
                        <g
                            key={t.id}
                            transform={`translate(${pos.x}, ${pos.y})`}
                        >
                            <circle r="3" fill="yellow" />
                            <g transform={`rotate(${t.heading})`}>
                                 <line x1="0" y1="0" x2="0" y2={-20} stroke="yellow" strokeWidth="1" />
                            </g>
                        </g>
                    );
                })}
            </svg>

            <div className="absolute bottom-2 left-2 text-zinc-500 text-xs">
                GOD VIEW (TRUE STATE)
            </div>
        </div>

        {/* SIDEBAR */}
        <div className="flex-1 bg-zinc-800 p-4 flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-zinc-700 pb-2">
                <h2 className="text-white font-bold">SCENARIO MGR</h2>
                <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            {selectedEntityId ? (
                <div className="space-y-4">
                    <div className="text-amber-500 font-mono text-lg mb-2">{selectedEntityId}</div>

                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-zinc-400">RANGE (yds)</label>
                        <input
                            type="number"
                            className="bg-zinc-900 text-white px-2 py-1 rounded border border-zinc-700"
                            value={formData.range}
                            onChange={e => setFormData({...formData, range: Number(e.target.value)})}
                        />

                        <label className="text-xs text-zinc-400">BEARING (deg)</label>
                        <input
                            type="number"
                            className="bg-zinc-900 text-white px-2 py-1 rounded border border-zinc-700"
                            value={formData.bearing}
                            onChange={e => setFormData({...formData, bearing: Number(e.target.value)})}
                        />

                        <label className="text-xs text-zinc-400">HEADING (deg)</label>
                        <input
                            type="number"
                            className="bg-zinc-900 text-white px-2 py-1 rounded border border-zinc-700"
                            value={formData.heading}
                            onChange={e => setFormData({...formData, heading: Number(e.target.value)})}
                        />

                        <label className="text-xs text-zinc-400">SPEED (kts)</label>
                        <input
                            type="number"
                            className="bg-zinc-900 text-white px-2 py-1 rounded border border-zinc-700"
                            value={formData.speed}
                            onChange={e => setFormData({...formData, speed: Number(e.target.value)})}
                        />

                        <label className="text-xs text-zinc-400">TYPE</label>
                        <select
                            className="bg-zinc-900 text-white px-2 py-1 rounded border border-zinc-700"
                            value={formData.type}
                            onChange={e => setFormData({...formData, type: e.target.value as any})}
                        >
                            <option value="ENEMY">ENEMY</option>
                            <option value="NEUTRAL">NEUTRAL</option>
                        </select>
                    </div>

                    <button
                        onClick={handleUpdate}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded mt-4 font-bold"
                    >
                        UPDATE ENTITY
                    </button>

                    <button
                        onClick={handleDelete}
                        className="w-full bg-red-900/50 hover:bg-red-900 text-red-200 py-2 rounded mt-2 border border-red-800"
                    >
                        DELETE ENTITY
                    </button>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm italic">
                    Select a contact on the map
                </div>
            )}

            <div className="mt-auto pt-4 border-t border-zinc-700">
                <button
                    onClick={handleCreate}
                    className="w-full bg-green-700 hover:bg-green-600 text-white py-3 rounded font-bold"
                >
                    + ADD CONTACT
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

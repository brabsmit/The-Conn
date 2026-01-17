/**
 * Settings Modal
 * User preferences and advanced feature toggles
 */

import { useState } from 'react';

interface SettingsModalProps {
    onClose: () => void;
    showDevTools: boolean;
    onToggleDevTools: () => void;
    showAcousticTuning: boolean;
    onToggleAcousticTuning: () => void;
    onShowTutorial: () => void;
}

type Tab = 'general' | 'advanced' | 'help';

export const SettingsModal: React.FC<SettingsModalProps> = ({
    onClose,
    showDevTools,
    onToggleDevTools,
    showAcousticTuning,
    onToggleAcousticTuning,
    onShowTutorial
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('general');

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-900 border-2 border-cyan-500/50 rounded-lg shadow-2xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-cyan-900/50 to-zinc-900 border-b border-cyan-500/30 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-cyan-400 tracking-wide">
                        ⚙️ Settings
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-white transition-colors text-xl font-bold w-8 h-8"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 bg-zinc-950/50">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 px-6 py-3 font-bold text-sm transition-colors ${
                            activeTab === 'general'
                                ? 'bg-cyan-900/30 text-cyan-400 border-b-2 border-cyan-500'
                                : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        GENERAL
                    </button>
                    <button
                        onClick={() => setActiveTab('advanced')}
                        className={`flex-1 px-6 py-3 font-bold text-sm transition-colors ${
                            activeTab === 'advanced'
                                ? 'bg-cyan-900/30 text-cyan-400 border-b-2 border-cyan-500'
                                : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        ADVANCED
                    </button>
                    <button
                        onClick={() => setActiveTab('help')}
                        className={`flex-1 px-6 py-3 font-bold text-sm transition-colors ${
                            activeTab === 'help'
                                ? 'bg-cyan-900/30 text-cyan-400 border-b-2 border-cyan-500'
                                : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        HELP
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto px-6 py-6">
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4">Display Options</h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={onShowTutorial}
                                        className="w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded text-left transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-white font-bold">Show Tutorial</p>
                                                <p className="text-xs text-zinc-400 mt-1">Review the walkthrough guide</p>
                                            </div>
                                            <span className="text-cyan-400">→</span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-white mb-4">About</h3>
                                <div className="p-4 bg-zinc-800/50 border border-white/10 rounded">
                                    <p className="text-sm text-zinc-300 mb-2">
                                        <span className="text-cyan-400 font-bold">The Conn</span> - Submarine Combat Simulator
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                        Alpha Version - Realistic passive sonar and tactical motion analysis
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'advanced' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4">Developer Tools</h3>
                                <p className="text-sm text-zinc-400 mb-4">
                                    Enable advanced debugging and tuning features. These are intended for testing and may affect gameplay.
                                </p>

                                <div className="space-y-3">
                                    {/* Scenario Manager Toggle */}
                                    <label className="flex items-center justify-between p-4 bg-zinc-800 border border-white/10 rounded hover:bg-zinc-750 cursor-pointer transition-colors">
                                        <div>
                                            <p className="text-white font-bold">Scenario Manager</p>
                                            <p className="text-xs text-zinc-400 mt-1">Spawn contacts and modify the tactical situation</p>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={showDevTools}
                                                onChange={onToggleDevTools}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                                        </div>
                                    </label>

                                    {/* Acoustic Tuning Toggle */}
                                    <label className="flex items-center justify-between p-4 bg-zinc-800 border border-white/10 rounded hover:bg-zinc-750 cursor-pointer transition-colors">
                                        <div>
                                            <p className="text-white font-bold">Acoustic Tuning Panel</p>
                                            <p className="text-xs text-zinc-400 mt-1">Adjust sonar equipment, environment, and acoustic parameters</p>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={showAcousticTuning}
                                                onChange={onToggleAcousticTuning}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                                        </div>
                                    </label>
                                </div>

                                <div className="mt-6 p-4 bg-amber-900/20 border border-amber-700/50 rounded">
                                    <p className="text-amber-400 font-bold text-sm mb-2">⚠️ God Mode</p>
                                    <p className="text-xs text-zinc-400">
                                        Press <span className="text-white font-mono bg-black/50 px-2 py-1 rounded">Ctrl+Shift+D</span> to toggle God Mode, which reveals all contact positions and solutions on the NAV station.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'help' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4">Keyboard Shortcuts</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded">
                                        <span className="text-zinc-300">Toggle God Mode</span>
                                        <kbd className="px-3 py-1 bg-black/50 border border-white/20 rounded text-xs text-white font-mono">Ctrl+Shift+D</kbd>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded">
                                        <span className="text-zinc-300">Open Settings</span>
                                        <kbd className="px-3 py-1 bg-black/50 border border-white/20 rounded text-xs text-white font-mono">?</kbd>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-white mb-4">Quick Reference</h3>
                                <div className="space-y-4">
                                    <div className="p-4 bg-zinc-800/50 border border-white/10 rounded">
                                        <p className="text-white font-bold mb-2">Passive Sonar Basics</p>
                                        <ul className="text-sm text-zinc-400 space-y-1 ml-4 list-disc list-inside">
                                            <li>Passive sonar only detects bearing - not range</li>
                                            <li>Maneuver to get multiple bearings for TMA solution</li>
                                            <li>Your speed affects self-noise and detection capability</li>
                                            <li>Cavitation (&gt;18 knots) makes you extremely loud</li>
                                        </ul>
                                    </div>

                                    <div className="p-4 bg-zinc-800/50 border border-white/10 rounded">
                                        <p className="text-white font-bold mb-2">TMA Workflow</p>
                                        <ol className="text-sm text-zinc-400 space-y-1 ml-4 list-decimal list-inside">
                                            <li>Detect contact on sonar (bright line)</li>
                                            <li>Click contact to begin tracking</li>
                                            <li>Maneuver to change bearing angles</li>
                                            <li>Adjust range/course/speed knobs to fit bearings</li>
                                            <li>Mark solution when confident</li>
                                            <li>Engage via WCS station</li>
                                        </ol>
                                    </div>

                                    <div className="p-4 bg-zinc-800/50 border border-white/10 rounded">
                                        <p className="text-white font-bold mb-2">Speed vs Stealth</p>
                                        <div className="text-sm text-zinc-400 space-y-1">
                                            <p>• <span className="text-green-400">0-5 knots</span>: Very quiet, optimal detection</p>
                                            <p>• <span className="text-yellow-400">5-15 knots</span>: Moderate flow noise</p>
                                            <p>• <span className="text-orange-400">15-18 knots</span>: Significant flow noise</p>
                                            <p>• <span className="text-red-400">&gt;18 knots</span>: CAVITATION - extremely loud!</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-zinc-950/50 border-t border-white/10 px-6 py-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded font-bold text-sm bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

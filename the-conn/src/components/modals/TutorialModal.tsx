/**
 * Tutorial Modal
 * First-time user walkthrough of the submarine combat system
 */

import { useState } from 'react';

interface TutorialModalProps {
    onClose: () => void;
}

const tutorialSteps = [
    {
        title: "Welcome to The Conn",
        content: (
            <div className="space-y-4">
                <p className="text-lg">
                    You are the captain of a modern submarine. Your mission is to detect, track, and engage enemy contacts using passive sonar and tactical analysis.
                </p>
                <p>
                    This tutorial will guide you through the essential controls and displays.
                </p>
                <div className="mt-6 p-4 bg-amber-900/20 border border-amber-700/50 rounded">
                    <p className="text-amber-400 font-bold mb-2">⚠️ Stay Quiet, Stay Hidden</p>
                    <p className="text-sm">
                        Speed creates noise. The faster you go, the harder it is to hear contacts - and the easier it is for them to hear you.
                    </p>
                </div>
            </div>
        )
    },
    {
        title: "Sonar Display (Left Panel)",
        content: (
            <div className="space-y-4">
                <p>
                    The <span className="text-green-400 font-bold">Sonar Array</span> shows passive acoustic contacts as bright lines on a waterfall display.
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><span className="text-white font-bold">Bearing</span>: Horizontal position (0-360°)</li>
                    <li><span className="text-white font-bold">Brightness</span>: Signal strength</li>
                    <li><span className="text-white font-bold">Time</span>: Vertical axis (newest at top)</li>
                </ul>
                <p className="mt-4">
                    <span className="text-cyan-400 font-bold">Click on a contact</span> to begin tracking it.
                </p>
                <div className="mt-4 p-3 bg-zinc-800/50 border border-white/10 rounded">
                    <p className="text-xs text-zinc-400">
                        💡 <span className="text-white font-bold">[SOL]</span> button: Toggle solution overlay to see bearing lines
                    </p>
                </div>
            </div>
        )
    },
    {
        title: "Tactical Plot (Center Panel)",
        content: (
            <div className="space-y-4">
                <p>
                    The center display has three stations you can switch between:
                </p>
                <div className="space-y-3 ml-4">
                    <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded">
                        <p className="text-amber-400 font-bold">TMA STATION</p>
                        <p className="text-sm mt-1">Target Motion Analysis - Track contacts and solve for range, course, and speed</p>
                    </div>
                    <div className="p-3 bg-red-900/20 border border-red-700/50 rounded">
                        <p className="text-red-400 font-bold">WCS STATION</p>
                        <p className="text-sm mt-1">Weapons Control System - Fire torpedoes at tracked contacts</p>
                    </div>
                    <div className="p-3 bg-cyan-900/20 border border-cyan-700/50 rounded">
                        <p className="text-cyan-400 font-bold">NAV STATION</p>
                        <p className="text-sm mt-1">Navigation - See the tactical situation (positions, velocities)</p>
                    </div>
                </div>
            </div>
        )
    },
    {
        title: "TMA Controls (Right Panel)",
        content: (
            <div className="space-y-4">
                <p>
                    Use the <span className="text-amber-400 font-bold">TMA Controls</span> to track and analyze contacts:
                </p>
                <ol className="list-decimal list-inside space-y-3 ml-4">
                    <li>
                        <span className="text-white font-bold">Select a contact</span> from the list (or click on sonar)
                    </li>
                    <li>
                        <span className="text-white font-bold">Take bearings</span> over time as your submarine maneuvers
                    </li>
                    <li>
                        <span className="text-white font-bold">Adjust range/course/speed</span> using the rotary knobs until the solution matches observations
                    </li>
                    <li>
                        <span className="text-white font-bold">Mark solution</span> when confident about the contact's position
                    </li>
                    <li>
                        <span className="text-white font-bold">Drop contacts</span> using the × button if tracking too many
                    </li>
                </ol>
                <div className="mt-4 p-3 bg-amber-900/20 border border-amber-700/50 rounded">
                    <p className="text-amber-400 font-bold text-sm mb-2">⚠️ Baffles (Blind Zone)</p>
                    <p className="text-xs">
                        Your sonar array is blocked by your hull in the rear 60° arc (150-210° relative). Contacts entering baffles will hold their last bearing and automatically reappear when they exit.
                    </p>
                </div>
                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded">
                    <p className="text-sm">
                        <span className="text-blue-400 font-bold">TIP:</span> Change your own course to get different bearing angles - this helps solve the range triangle.
                    </p>
                </div>
            </div>
        )
    },
    {
        title: "Helm Controls (Bottom)",
        content: (
            <div className="space-y-4">
                <p>
                    Control your submarine's movement with the <span className="text-green-400 font-bold">Helm</span>:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                        <span className="text-white font-bold">Heading</span>: Click or drag the compass to change course
                    </li>
                    <li>
                        <span className="text-white font-bold">Speed</span>: Use the throttle to adjust speed (affects noise!)
                    </li>
                    <li>
                        <span className="text-white font-bold">Depth</span>: Control your depth for tactical advantage
                    </li>
                </ul>
                <div className="mt-4 p-4 bg-red-900/20 border border-red-700/50 rounded">
                    <p className="text-red-400 font-bold mb-2">⚠️ CAVITATION WARNING</p>
                    <p className="text-sm">
                        Speeds above 18 knots cause cavitation - extreme noise that makes you easy to detect. Use sparingly!
                    </p>
                </div>
            </div>
        )
    },
    {
        title: "Top Bar Information",
        content: (
            <div className="space-y-4">
                <p>
                    The top bar displays critical information:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                        <span className="text-white font-bold">SIM TIME</span>: Mission elapsed time
                    </li>
                    <li>
                        <span className="text-white font-bold">HDG/SPEED/DEPTH</span>: Current submarine state
                    </li>
                    <li>
                        <span className="text-white font-bold">Message Ticker</span>: Important events and alerts (click to see history)
                    </li>
                    <li>
                        <span className="text-white font-bold">TIMESCALE</span>: (FAST/MED/SLOW)
                    </li>
                </ul>
                <div className="mt-4 p-3 bg-zinc-800/50 border border-white/10 rounded">
                    <p className="text-xs text-zinc-400">
                        💡 Use <span className="text-white font-bold">SLOW</span> timescale when making precise TMA adjustments
                    </p>
                </div>
            </div>
        )
    },
    {
        title: "Ready to Begin",
        content: (
            <div className="space-y-4">
                <p className="text-lg">
                    You now know the basics of submarine command!
                </p>
                <div className="space-y-3 mt-6">
                    <div className="p-4 bg-amber-900/20 border border-amber-700/50 rounded">
                        <p className="text-amber-400 font-bold mb-2">Your First Mission:</p>
                        <ol className="text-sm space-y-1 ml-4 list-decimal list-inside">
                            <li>Watch the sonar for contacts</li>
                            <li>Click on a bright line to track it</li>
                            <li>Maneuver to get different bearing angles</li>
                            <li>Keep all contacts outside 2000 yards!</li>
                        </ol>
                    </div>
                    <div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded">
                        <p className="text-blue-400 font-bold mb-2">Need Help?</p>
                        <p className="text-sm">
                            Press <span className="text-white font-mono bg-black/50 px-2 py-1 rounded">?</span> or click the gear icon to access settings and help.
                        </p>
                    </div>
                </div>
            </div>
        )
    }
];

export const TutorialModal: React.FC<TutorialModalProps> = ({ onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);

    const step = tutorialSteps[currentStep];
    const isLastStep = currentStep === tutorialSteps.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            onClose();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        setCurrentStep(prev => Math.max(0, prev - 1));
    };

    const handleSkip = () => {
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-900 border-2 border-amber-500/50 rounded-lg shadow-2xl w-[90vw] max-w-3xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-900/50 to-zinc-900 border-b border-amber-500/30 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-amber-400 tracking-wide">
                            {step.title}
                        </h2>
                        <p className="text-xs text-zinc-400 mt-1">
                            Step {currentStep + 1} of {tutorialSteps.length}
                        </p>
                    </div>
                    <button
                        onClick={handleSkip}
                        className="text-zinc-500 hover:text-white transition-colors text-sm"
                    >
                        Skip Tutorial
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto px-6 py-6 text-zinc-300">
                    {step.content}
                </div>

                {/* Progress Indicator */}
                <div className="px-6 py-3 flex gap-1">
                    {tutorialSteps.map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-1 flex-1 rounded ${
                                idx === currentStep
                                    ? 'bg-amber-500'
                                    : idx < currentStep
                                    ? 'bg-amber-700/50'
                                    : 'bg-zinc-700/50'
                            }`}
                        />
                    ))}
                </div>

                {/* Footer */}
                <div className="bg-zinc-950/50 border-t border-white/10 px-6 py-4 flex justify-between">
                    <button
                        onClick={handlePrev}
                        disabled={currentStep === 0}
                        className={`px-6 py-2 rounded font-bold text-sm transition-colors ${
                            currentStep === 0
                                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                : 'bg-zinc-700 text-white hover:bg-zinc-600'
                        }`}
                    >
                        ← Previous
                    </button>
                    <button
                        onClick={handleNext}
                        className="px-8 py-2 rounded font-bold text-sm bg-amber-600 text-white hover:bg-amber-500 transition-colors shadow-lg"
                    >
                        {isLastStep ? 'Begin Mission →' : 'Next →'}
                    </button>
                </div>
            </div>
        </div>
    );
};

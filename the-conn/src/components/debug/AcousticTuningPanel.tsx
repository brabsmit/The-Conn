/**
 * Acoustic Tuning Panel
 * Runtime controls for sonar equipment, environment, and contact parameters
 * Useful for testing, balancing, and gameplay tuning
 */

import React, { useState } from 'react';
import { SONAR_EQUIPMENT } from '../../config/SonarEquipment';
import { ENVIRONMENTS } from '../../config/EnvironmentConfig';
import { ACOUSTICS } from '../../config/AcousticConstants';

interface AcousticTuningPanelProps {
    onEquipmentChange?: (equipmentId: string) => void;
    onEnvironmentChange?: (environmentId: string) => void;
    onSourceLevelAdjust?: (contactType: string, delta: number) => void;
    onSeaStateChange?: (seaState: number) => void;
    onSpeedChange?: (speed: number) => void;
}

export const AcousticTuningPanel: React.FC<AcousticTuningPanelProps> = ({
    onEquipmentChange,
    onEnvironmentChange,
    onSourceLevelAdjust,
    onSeaStateChange,
    onSpeedChange,
}) => {
    const [collapsed, setCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState<'equipment' | 'environment' | 'contacts' | 'ownship'>('equipment');

    const [selectedEquipment, setSelectedEquipment] = useState('STANDARD');
    const [selectedEnvironment, setSelectedEnvironment] = useState('NORTH_ATLANTIC');
    const [seaState, setSeaState] = useState(3);
    const [ownSpeed, setOwnSpeed] = useState(5);

    const handleEquipmentChange = (id: string) => {
        setSelectedEquipment(id);
        onEquipmentChange?.(id);
    };

    const handleEnvironmentChange = (id: string) => {
        setSelectedEnvironment(id);
        onEnvironmentChange?.(id);
    };

    const handleSeaStateChange = (value: number) => {
        setSeaState(value);
        onSeaStateChange?.(value);
    };

    const handleSpeedChange = (value: number) => {
        setOwnSpeed(value);
        onSpeedChange?.(value);
    };

    const handleSourceLevelAdjust = (contactType: string, delta: number) => {
        onSourceLevelAdjust?.(contactType, delta);
    };

    if (collapsed) {
        return (
            <div style={styles.collapsedContainer}>
                <button onClick={() => setCollapsed(false)} style={styles.expandButton}>
                    🎛️ Acoustic Tuning
                </button>
            </div>
        );
    }

    const equipment = SONAR_EQUIPMENT[selectedEquipment];
    const environment = ENVIRONMENTS[selectedEnvironment];

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>🎛️ Acoustic Tuning Panel</h3>
                <button onClick={() => setCollapsed(true)} style={styles.collapseButton}>
                    ✕
                </button>
            </div>

            <div style={styles.tabs}>
                <button
                    onClick={() => setActiveTab('equipment')}
                    style={activeTab === 'equipment' ? styles.tabActive : styles.tab}
                >
                    Equipment
                </button>
                <button
                    onClick={() => setActiveTab('environment')}
                    style={activeTab === 'environment' ? styles.tabActive : styles.tab}
                >
                    Environment
                </button>
                <button
                    onClick={() => setActiveTab('contacts')}
                    style={activeTab === 'contacts' ? styles.tabActive : styles.tab}
                >
                    Contacts
                </button>
                <button
                    onClick={() => setActiveTab('ownship')}
                    style={activeTab === 'ownship' ? styles.tabActive : styles.tab}
                >
                    Ownship
                </button>
            </div>

            <div style={styles.content}>
                {activeTab === 'equipment' && (
                    <div style={styles.section}>
                        <h4 style={styles.sectionTitle}>Sonar Equipment</h4>
                        <select
                            value={selectedEquipment}
                            onChange={(e) => handleEquipmentChange(e.target.value)}
                            style={styles.select}
                        >
                            {Object.entries(SONAR_EQUIPMENT).map(([id, eq]) => (
                                <option key={id} value={id}>
                                    {eq.name}
                                </option>
                            ))}
                        </select>

                        <div style={styles.stats}>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Description:</span>
                                <span style={styles.value}>{equipment.description}</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Beam Resolution:</span>
                                <span style={styles.value}>{equipment.numBeams} beams @ {equipment.beamSpacing}°</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Beam Width:</span>
                                <span style={styles.value}>{equipment.beamWidth}°</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Directivity Index:</span>
                                <span style={styles.value}>+{equipment.directivityIndex} dB</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Self-Noise Base:</span>
                                <span style={styles.value}>{equipment.selfNoiseBase} dB</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Flow Noise Factor:</span>
                                <span style={styles.value}>{equipment.flowNoiseFactor}</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Beamforming:</span>
                                <span style={styles.value}>{equipment.beamformingWindow}</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Dynamic Range:</span>
                                <span style={styles.value}>{equipment.dynamicRange} dB</span>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'environment' && (
                    <div style={styles.section}>
                        <h4 style={styles.sectionTitle}>Environmental Conditions</h4>
                        <select
                            value={selectedEnvironment}
                            onChange={(e) => handleEnvironmentChange(e.target.value)}
                            style={styles.select}
                        >
                            {Object.entries(ENVIRONMENTS).map(([id, env]) => (
                                <option key={id} value={id}>
                                    {env.name}
                                </option>
                            ))}
                        </select>

                        <div style={styles.stats}>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Description:</span>
                                <span style={styles.value}>{environment.description}</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Water Depth:</span>
                                <span style={styles.value}>{environment.waterDepth}m ({environment.deepWater ? 'Deep' : 'Shallow'})</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Sea State:</span>
                                <span style={styles.value}>{environment.seaState} (Base: {ACOUSTICS.ENVIRONMENT.SEA_STATE_NOISE[environment.seaState]} dB)</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Temperature:</span>
                                <span style={styles.value}>{environment.surfaceTemperature}°C</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Velocity Profile:</span>
                                <span style={styles.value}>{environment.soundVelocityProfile}</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Biologics:</span>
                                <span style={styles.value}>{environment.biologicLevel > 0 ? '+' : ''}{environment.biologicLevel} dB</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Shipping:</span>
                                <span style={styles.value}>{environment.shippingLevel > 0 ? '+' : ''}{environment.shippingLevel} dB</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Bottom Type:</span>
                                <span style={styles.value}>{environment.bottomType} ({environment.bottomLoss} dB loss)</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Propagation:</span>
                                <span style={styles.value}>
                                    {environment.convergenceZones && 'CZ '}
                                    {environment.surfaceDuct && 'Duct '}
                                    {environment.bottomBounce && 'Bottom'}
                                </span>
                            </div>
                        </div>

                        <div style={styles.sliderSection}>
                            <label style={styles.sliderLabel}>
                                Override Sea State: {seaState}
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="6"
                                step="1"
                                value={seaState}
                                onChange={(e) => handleSeaStateChange(parseInt(e.target.value))}
                                style={styles.slider}
                            />
                            <div style={styles.sliderHint}>
                                Noise: {ACOUSTICS.ENVIRONMENT.SEA_STATE_NOISE[seaState]} dB
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'contacts' && (
                    <div style={styles.section}>
                        <h4 style={styles.sectionTitle}>Contact Source Levels</h4>
                        <div style={styles.hint}>
                            Adjust source levels for all contacts of each type
                        </div>

                        {Object.entries(ACOUSTICS.SOURCE_LEVELS).map(([type, baseLevel]) => (
                            <div key={type} style={styles.contactControl}>
                                <div style={styles.contactHeader}>
                                    <span style={styles.contactType}>{type}</span>
                                    <span style={styles.contactLevel}>{baseLevel} dB</span>
                                </div>
                                <div style={styles.buttonGroup}>
                                    <button
                                        onClick={() => handleSourceLevelAdjust(type, -5)}
                                        style={styles.adjustButton}
                                    >
                                        -5 dB
                                    </button>
                                    <button
                                        onClick={() => handleSourceLevelAdjust(type, -1)}
                                        style={styles.adjustButton}
                                    >
                                        -1 dB
                                    </button>
                                    <button
                                        onClick={() => handleSourceLevelAdjust(type, +1)}
                                        style={styles.adjustButton}
                                    >
                                        +1 dB
                                    </button>
                                    <button
                                        onClick={() => handleSourceLevelAdjust(type, +5)}
                                        style={styles.adjustButton}
                                    >
                                        +5 dB
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'ownship' && (
                    <div style={styles.section}>
                        <h4 style={styles.sectionTitle}>Ownship Parameters</h4>

                        <div style={styles.sliderSection}>
                            <label style={styles.sliderLabel}>
                                Speed: {ownSpeed} knots
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="30"
                                step="1"
                                value={ownSpeed}
                                onChange={(e) => handleSpeedChange(parseInt(e.target.value))}
                                style={styles.slider}
                            />
                            <div style={styles.sliderHint}>
                                {ownSpeed > 18 && '⚠️ Cavitating!'}
                                {ownSpeed <= 5 && '✓ Quiet'}
                                {ownSpeed > 5 && ownSpeed <= 18 && '⚡ Flow noise increasing'}
                            </div>
                        </div>

                        <div style={styles.stats}>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Self-Noise Base:</span>
                                <span style={styles.value}>{equipment.selfNoiseBase} dB</span>
                            </div>
                            <div style={styles.statRow}>
                                <span style={styles.label}>Flow Noise:</span>
                                <span style={styles.value}>
                                    +{(ownSpeed * ownSpeed * equipment.flowNoiseFactor).toFixed(1)} dB
                                </span>
                            </div>
                            {ownSpeed > 18 && (
                                <div style={styles.statRow}>
                                    <span style={styles.label}>Cavitation:</span>
                                    <span style={{...styles.value, color: '#ff4444'}}>
                                        +{Math.min(40, (ownSpeed - 18) * (ownSpeed - 18) * 0.3).toFixed(1)} dB
                                    </span>
                                </div>
                            )}
                            <div style={styles.statRow}>
                                <span style={styles.label}>Total Self-Noise:</span>
                                <span style={{...styles.value, fontWeight: 'bold'}}>
                                    {(() => {
                                        let sn = equipment.selfNoiseBase + (ownSpeed * ownSpeed * equipment.flowNoiseFactor);
                                        if (ownSpeed > 18) {
                                            sn += Math.min(40, (ownSpeed - 18) * (ownSpeed - 18) * 0.3);
                                        }
                                        return sn.toFixed(1);
                                    })()} dB
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    collapsedContainer: {
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 9999,
    },
    expandButton: {
        padding: '8px 16px',
        backgroundColor: '#2a2a2a',
        color: '#00ff00',
        border: '1px solid #00ff00',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'monospace',
        fontSize: '12px',
    },
    container: {
        position: 'fixed',
        top: '10px',
        right: '10px',
        width: '400px',
        maxHeight: '80vh',
        backgroundColor: '#1a1a1a',
        border: '2px solid #00ff00',
        borderRadius: '8px',
        color: '#00ff00',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 9999,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px',
        backgroundColor: '#0a0a0a',
        borderBottom: '1px solid #00ff00',
    },
    title: {
        margin: 0,
        fontSize: '14px',
        fontWeight: 'bold',
    },
    collapseButton: {
        background: 'none',
        border: 'none',
        color: '#00ff00',
        fontSize: '16px',
        cursor: 'pointer',
        padding: '4px 8px',
    },
    tabs: {
        display: 'flex',
        backgroundColor: '#0a0a0a',
        borderBottom: '1px solid #00ff00',
    },
    tab: {
        flex: 1,
        padding: '8px',
        backgroundColor: '#1a1a1a',
        color: '#00aa00',
        border: 'none',
        borderRight: '1px solid #003300',
        cursor: 'pointer',
        fontSize: '11px',
    },
    tabActive: {
        flex: 1,
        padding: '8px',
        backgroundColor: '#0a0a0a',
        color: '#00ff00',
        border: 'none',
        borderRight: '1px solid #003300',
        borderBottom: '2px solid #00ff00',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 'bold',
    },
    content: {
        padding: '12px',
        overflowY: 'auto',
        flex: 1,
    },
    section: {
        marginBottom: '16px',
    },
    sectionTitle: {
        margin: '0 0 8px 0',
        fontSize: '13px',
        color: '#00ffff',
    },
    select: {
        width: '100%',
        padding: '8px',
        backgroundColor: '#0a0a0a',
        color: '#00ff00',
        border: '1px solid #00ff00',
        borderRadius: '4px',
        fontSize: '12px',
        marginBottom: '12px',
    },
    stats: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    statRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 0',
        borderBottom: '1px solid #003300',
    },
    label: {
        color: '#00aa00',
        fontSize: '11px',
    },
    value: {
        color: '#00ff00',
        fontSize: '11px',
        fontWeight: 'bold',
        textAlign: 'right',
    },
    hint: {
        fontSize: '10px',
        color: '#00aa00',
        marginBottom: '12px',
        fontStyle: 'italic',
    },
    contactControl: {
        marginBottom: '12px',
        padding: '8px',
        backgroundColor: '#0a0a0a',
        border: '1px solid #003300',
        borderRadius: '4px',
    },
    contactHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
    },
    contactType: {
        fontSize: '12px',
        fontWeight: 'bold',
    },
    contactLevel: {
        fontSize: '12px',
        color: '#00ffff',
    },
    buttonGroup: {
        display: 'flex',
        gap: '4px',
    },
    adjustButton: {
        flex: 1,
        padding: '6px',
        backgroundColor: '#0a0a0a',
        color: '#00ff00',
        border: '1px solid #00ff00',
        borderRadius: '3px',
        cursor: 'pointer',
        fontSize: '10px',
    },
    sliderSection: {
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#0a0a0a',
        border: '1px solid #003300',
        borderRadius: '4px',
    },
    sliderLabel: {
        display: 'block',
        marginBottom: '8px',
        fontSize: '12px',
        fontWeight: 'bold',
    },
    slider: {
        width: '100%',
        marginBottom: '4px',
    },
    sliderHint: {
        fontSize: '10px',
        color: '#00aa00',
        fontStyle: 'italic',
    },
};

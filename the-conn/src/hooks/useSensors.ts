/**
 * Domain hook for sensor readings and alerts
 * Provides access to sonar, visual, and acoustic sensor data
 */

import { useSubmarineStore } from '../store/useSubmarineStore';
import type { SensorReading, Transient, VisualTransient, ActiveIntercept } from '../store/types';

export interface SensorState {
  sensorReadings: SensorReading[];
  logs: Array<{ message: string; timestamp: number; type?: 'INFO' | 'ALERT' }>;
  alertLevel: 'NORMAL' | 'COMBAT';
  incomingTorpedoDetected: boolean;
  transients: Transient[];
  visualTransients: VisualTransient[];
  activeIntercepts: ActiveIntercept[];
}

export interface SensorActions {
  addLog: (message: string, type?: 'INFO' | 'ALERT') => void;
}

/**
 * Hook to access sensor state
 * @returns Current sensor readings and alerts
 */
export const useSensorState = (): SensorState => {
  return useSubmarineStore((state) => ({
    sensorReadings: state.sensorReadings,
    logs: state.logs,
    alertLevel: state.alertLevel,
    incomingTorpedoDetected: state.incomingTorpedoDetected,
    transients: state.transients,
    visualTransients: state.visualTransients,
    activeIntercepts: state.activeIntercepts,
  }));
};

/**
 * Hook to access sensor actions
 * @returns Sensor-related actions
 */
export const useSensorActions = (): SensorActions => {
  return useSubmarineStore((state) => ({
    addLog: state.addLog,
  }));
};

/**
 * Convenience hooks for specific sensor data
 */

export const useSensorReadings = () => {
  return useSubmarineStore((state) => state.sensorReadings);
};

export const useLogs = () => {
  return useSubmarineStore((state) => state.logs);
};

export const useAlertLevel = () => {
  return useSubmarineStore((state) => state.alertLevel);
};

export const useIncomingTorpedoDetected = () => {
  return useSubmarineStore((state) => state.incomingTorpedoDetected);
};

export const useTransients = () => {
  return useSubmarineStore((state) => state.transients);
};

export const useVisualTransients = () => {
  return useSubmarineStore((state) => state.visualTransients);
};

export const useActiveIntercepts = () => {
  return useSubmarineStore((state) => state.activeIntercepts);
};

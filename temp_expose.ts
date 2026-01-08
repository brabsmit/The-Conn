import { useSubmarineStore } from './store/useSubmarineStore';
declare global { interface Window { useSubmarineStore: any; } }
if (typeof window !== 'undefined') { window.useSubmarineStore = useSubmarineStore; }

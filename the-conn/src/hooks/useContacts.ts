/**
 * Domain hook for contact management
 * Provides access to enemy and neutral contacts in the simulation
 */

import { useSubmarineStore } from '../store/useSubmarineStore';
import type { Contact } from '../store/types';

export interface ContactState {
  contacts: Contact[];
}

export interface ContactActions {
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  removeContact: (id: string) => void;
}

/**
 * Hook to access contact state
 * @returns All contacts in the simulation
 */
export const useContactState = (): ContactState => {
  return useSubmarineStore((state) => ({
    contacts: state.contacts,
  }));
};

/**
 * Hook to access contact actions
 * @returns Contact management actions
 */
export const useContactActions = (): ContactActions => {
  return useSubmarineStore((state) => ({
    addContact: state.addContact,
    updateContact: state.updateContact,
    removeContact: state.removeContact,
  }));
};

/**
 * Convenience hooks for specific contact data
 */

export const useContacts = () => {
  return useSubmarineStore((state) => state.contacts);
};

export const useContact = (contactId: string) => {
  return useSubmarineStore((state) =>
    state.contacts.find(c => c.id === contactId)
  );
};

/**
 * Hook to get contacts by type
 */
export const useEnemyContacts = () => {
  return useSubmarineStore((state) =>
    state.contacts.filter(c => c.type === 'ENEMY')
  );
};

export const useNeutralContacts = () => {
  return useSubmarineStore((state) =>
    state.contacts.filter(c => c.type === 'NEUTRAL')
  );
};

/**
 * Hook to get contacts by classification
 */
export const useContactsByClassification = (classification: Contact['classification']) => {
  return useSubmarineStore((state) =>
    state.contacts.filter(c => c.classification === classification)
  );
};

/**
 * Hook to get active contacts (not destroyed)
 */
export const useActiveContacts = () => {
  return useSubmarineStore((state) =>
    state.contacts.filter(c => c.status === 'ACTIVE' || !c.status)
  );
};

/**
 * Hook to get contacts by AI mode
 */
export const useContactsByAIMode = (aiMode: Contact['aiMode']) => {
  return useSubmarineStore((state) =>
    state.contacts.filter(c => c.aiMode === aiMode)
  );
};

/**
 * Hook to get hostile contacts (attacking or prosecuting)
 */
export const useHostileContacts = () => {
  return useSubmarineStore((state) =>
    state.contacts.filter(c =>
      c.aiMode === 'ATTACK' || c.aiMode === 'PROSECUTE' || c.aiMode === 'APPROACH'
    )
  );
};

/**
 * Hook to get contact count
 */
export const useContactCount = () => {
  return useSubmarineStore((state) => state.contacts.length);
};

export const useActiveContactCount = () => {
  return useSubmarineStore((state) =>
    state.contacts.filter(c => c.status === 'ACTIVE' || !c.status).length
  );
};

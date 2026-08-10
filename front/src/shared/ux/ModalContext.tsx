/**
 * GAPAK Global Modal Manager Context
 * Supports opening and stacking dynamic modals from anywhere in the app
 */

import React, { createContext, useContext, useState, ReactNode, ComponentType } from 'react';
import { Dialog } from '../design-system/primitives';

export interface ModalConfig<T = any> {
  id: string;
  component: ComponentType<T>;
  props?: T;
  title?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

interface ModalContextValue {
  openModal: <T>(component: ComponentType<T>, props?: T, title?: string) => string;
  closeModal: (id?: string) => void;
  closeAllModals: () => void;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modals, setModals] = useState<ModalConfig[]>([]);

  const openModal = <T,>(component: ComponentType<T>, props?: T, title?: string): string => {
    const id = `modal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setModals((prev) => [...prev, { id, component, props, title }]);
    return id;
  };

  const closeModal = (id?: string) => {
    setModals((prev) => {
      if (!id) return prev.slice(0, -1);
      return prev.filter((m) => m.id !== id);
    });
  };

  const closeAllModals = () => setModals([]);

  return (
    <ModalContext.Provider value={{ openModal, closeModal, closeAllModals }}>
      {children}
      {modals.map((modal) => {
        const Component = modal.component;
        return (
          <Dialog
            key={modal.id}
            isOpen={true}
            onClose={() => closeModal(modal.id)}
            title={modal.title}
            maxWidth={modal.maxWidth || 'md'}
          >
            <Component {...(modal.props || {})} closeModal={() => closeModal(modal.id)} />
          </Dialog>
        );
      })}
    </ModalContext.Provider>
  );
};

export const useModal = (): ModalContextValue => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
};

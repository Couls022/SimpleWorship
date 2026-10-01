import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export function withPortal<P extends object>(Component: React.ComponentType<P>) {
  return function PortaledComponent(props: P) {
    useEffect(() => {
      if (typeof document === 'undefined') return;
      // Mark system overlay modal open state
      document.body.classList.add('system-modal-active');
      return () => {
        // Only remove if no other modals are active
        const otherModals = document.querySelectorAll('[data-portal-modal]');
        if (otherModals.length <= 1) {
          document.body.classList.remove('system-modal-active');
        }
      };
    }, []);

    if (typeof document === 'undefined') return <Component {...props} />;
    
    return createPortal(
      <div 
        data-portal-modal="true"
        className="fixed inset-0 z-[999999] pointer-events-auto [isolation:isolate] transform-gpu"
        style={{ transform: 'translateZ(0)' }}
      >
        <Component {...props} />
      </div>, 
      document.body
    );
  };
}

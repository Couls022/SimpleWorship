import React from 'react';
import { createPortal } from 'react-dom';

export function withPortal<P extends object>(Component: React.ComponentType<P>) {
  return function PortaledComponent(props: P) {
    if (typeof document === 'undefined') return <Component {...props} />;
    return createPortal(<Component {...props} />, document.body);
  };
}

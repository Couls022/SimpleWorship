import React, { ReactNode, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PortalDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement>;
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right';
  zIndex?: number;
}

export function PortalDropdown({
  isOpen,
  onClose,
  triggerRef,
  children,
  className = '',
  align = 'left',
  zIndex = 1000000
}: PortalDropdownProps) {
  const [style, setStyle] = useState<React.CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      
      let left: number | undefined = rect.left;
      let right: number | undefined = undefined;

      if (align === 'right') {
        left = undefined;
        right = window.innerWidth - rect.right;
      }

      setStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left,
        right,
        zIndex,
        minWidth: rect.width
      });
    }
  };

  useLayoutEffect(() => {
    updatePosition();
    if (isOpen) {
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, align]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isOutsideTrigger = triggerRef.current && !triggerRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      
      if (isOpen && isOutsideTrigger && isOutsideDropdown) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside, true); // use capture to ensure it runs
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div 
      ref={dropdownRef}
      className={className} 
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

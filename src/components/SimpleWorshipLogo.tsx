import React from 'react';
import { BrandConfig } from '../config/branding';

interface SimpleWorshipLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  variant?: 'full' | 'icon' | 'badge';
  subtitle?: string;
}

export function SimpleWorshipLogo({
  size = 24,
  showText = true,
  className = '',
  variant = 'full',
  subtitle
}: SimpleWorshipLogoProps) {
  const iconSize = size;
  
  // Official 3D SW Brand assets
  const logoSrc = (variant === 'icon' || !showText) 
    ? BrandConfig.logoIcon 
    : BrandConfig.logoLight;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Official 3D SW Brand Logo Asset */}
      <img 
        src={logoSrc} 
        alt={BrandConfig.productName} 
        style={{ height: `${iconSize}px`, width: (variant === 'icon' || !showText) ? `${iconSize}px` : 'auto', objectFit: 'contain' }}
        className="shrink-0 drop-shadow-sm"
        onError={(e) => {
          // Fallback to inline SVG or relative path
          const target = e.currentTarget;
          if (!target.dataset.fallback) {
            target.dataset.fallback = 'true';
            target.src = '/branding/logo/SimpleWorship-icon.svg';
          }
        }}
      />

      {/* Optional Subtitle */}
      {showText && variant !== 'icon' && subtitle && (
        <div className="flex flex-col leading-none border-l border-gray-700 pl-2.5 ml-0.5">
          <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}

export default SimpleWorshipLogo;

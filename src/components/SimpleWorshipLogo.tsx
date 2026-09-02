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
  
  // Decide which official logo asset to show based on variant/showText
  const logoSrc = (variant === 'icon' || !showText) 
    ? BrandConfig.logoIcon 
    : BrandConfig.logoLight; // Defaulting to light variant for dark UI backgrounds

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Official Brand Image Asset */}
      <img 
        src={logoSrc} 
        alt={BrandConfig.productName} 
        style={{ height: `${iconSize}px`, objectFit: 'contain' }}
        className="shrink-0"
      />

      {/* Optional Subtitle (if requested for UI context, not part of the logo itself) */}
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

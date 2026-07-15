import React from 'react';
import logoUrl from '@/assets/logo.png';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export default function Logo({ className = "w-16 h-16" }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt="Hightide Vintage"
      draggable={false}
      className={`object-contain select-none ${className}`}
      id="brand-logo"
    />
  );
}

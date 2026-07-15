import React from 'react';
import fontUrl from '@/assets/font_homepage.png';

interface HightideLogoProps {
  className?: string;
  color?: string; // "white" inverts the black artwork to white
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
}

export default function HightideLogo({ className = "h-12", color = "currentColor", onClick }: HightideLogoProps) {
  return (
    <img
      src={fontUrl}
      alt="hightide"
      draggable={false}
      onClick={onClick}
      className={`object-contain select-none ${color === 'white' ? 'invert' : ''} ${className}`}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      id="hightide-cursive-logo"
    />
  );
}

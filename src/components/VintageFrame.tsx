import React from 'react';

interface VintageFrameProps {
  borderType?: string;
  children: React.ReactNode;
}

export default function VintageFrame({ children }: VintageFrameProps) {
  return (
    <div className="relative w-full h-full bg-gray-50 flex items-center justify-center overflow-hidden aspect-square border border-gray-100 rounded-lg">
      {children}
    </div>
  );
}

import React from 'react';

interface GradientBannerProps {
  children: React.ReactNode;
  className?: string;
  isExport?: boolean;
}

export const GradientBanner: React.FC<GradientBannerProps> = ({ 
  children, 
  className = "",
  isExport = false
}) => {
  return (
    <div className={`relative bg-gradient-to-br from-blue-900 via-primary-glow to-green-900/80 ${className}`} style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)', width: '100vw' }}>
      {children}
    </div>
  );
}; 
import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    gradient?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', gradient = false }) => {
    return (
        <div className={`
      relative overflow-hidden rounded-2xl border border-premium-border
      bg-premium-card backdrop-blur-xl shadow-glass
      transition-all duration-300 hover:shadow-glow-cyan/20
      ${gradient ? 'bg-glass-gradient' : ''}
      ${className}
    `}>
            {children}
        </div>
    );
};

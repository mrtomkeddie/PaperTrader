import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    fullWidth?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    isLoading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    disabled,
    ...props
}) => {

    const baseStyles = "inline-flex items-center justify-center rounded-xl font-bold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ring-offset-premium-bg disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-premium-gold text-black hover:bg-premium-gold-dim shadow-glow-gold hover:shadow-glow-gold/80 hover:-translate-y-0.5",
        secondary: "bg-premium-card border border-premium-border text-gray-200 hover:bg-white/5 hover:border-premium-gold/50 hover:text-white shadow-glass",
        ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-white/5",
        danger: "bg-red-500/10 border border-red-500/50 text-red-500 hover:bg-red-500/20 shadow-glow-red",
        outline: "bg-transparent border border-premium-cyan/50 text-premium-cyan hover:bg-premium-cyan/10 hover:shadow-glow-cyan",
    };

    const sizes = {
        sm: "h-8 px-3 text-xs",
        md: "h-11 px-6 text-sm tracking-wide",
        lg: "h-14 px-8 text-base",
        icon: "h-10 w-10 p-0",
    };

    const widthClass = fullWidth ? "w-full" : "";

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
                <>
                    {leftIcon && <span className="mr-2">{leftIcon}</span>}
                    {children}
                    {rightIcon && <span className="ml-2">{rightIcon}</span>}
                </>
            )}
        </button>
    );
};

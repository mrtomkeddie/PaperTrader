import React from 'react';
import { LayoutDashboard, Terminal, History, Settings, LogOut } from 'lucide-react';
import { AssetSymbol } from '../types';

interface SidebarProps {
    activeView: 'dashboard' | 'history' | 'settings';
    setActiveView: (view: 'dashboard' | 'history' | 'settings') => void;
    onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, onOpenSettings }) => {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' },
        { id: 'history', label: 'History', icon: History, view: 'history' },
    ];

    return (
        <div className="hidden md:flex flex-col w-64 h-screen sticky top-0 p-4 border-r border-premium-border bg-black/40 backdrop-blur-xl">
            {/* Logo Area */}
            <div className="flex items-center justify-center px-4 pb-8 pt-6 relative group/logo">
                <div className="absolute inset-0 bg-premium-gold/20 blur-[50px] rounded-full opacity-0 transition-opacity duration-700 pointer-events-none" />
                <img src="/bulllogo.svg" alt="Paper Trader" className="h-16 w-auto object-contain drop-shadow-[0_0_25px_rgba(212,175,55,0.3)] transition-transform duration-500 group-hover/logo:scale-105 relative z-10" />
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-3">
                {navItems.map((item) => {
                    const isActive = activeView === item.view && (item.id === 'terminal' ? false : true);
                    const isSelected = activeView === item.view;

                    return (
                        <div key={item.id} className="relative group">
                            {isSelected && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-premium-gold to-premium-cyan rounded-r-full shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all duration-300" />
                            )}
                            <button
                                onClick={() => setActiveView(item.view as any)}
                                className={`w-full flex items-center gap-4 px-6 py-3.5 rounded-xl transition-all duration-300 mx-2 w-[calc(100%-16px)] ${isSelected
                                    ? 'bg-white/5 text-white font-bold tracking-wide shadow-glass'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5 font-medium'
                                    }`}
                            >
                                <item.icon
                                    size={20}
                                    className={`transition-all duration-300 ${isSelected ? 'text-premium-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]' : 'group-hover:text-premium-gold'}`}
                                    strokeWidth={isSelected ? 2.5 : 2}
                                />
                                <span className={isSelected ? 'text-sm' : 'text-sm'}>{item.label}</span>
                            </button>
                        </div>
                    );
                })}
            </nav>

            {/* Bottom Actions */}
            <div className="mt-auto space-y-2">
                <button
                    onClick={onOpenSettings}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all group border border-transparent hover:border-premium-gold/30"
                >
                    <Settings size={20} className="group-hover:rotate-90 transition-transform duration-500 text-premium-gold/70 group-hover:text-premium-gold" />
                    <span className="font-medium tracking-wide text-sm group-hover:text-premium-gold transition-colors">Settings</span>
                </button>


            </div>
        </div>
    );
};

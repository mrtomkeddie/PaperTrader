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
            <div className="flex items-center justify-center px-4 pb-4 pt-0 mb-6 mt-0">
                <img src="/pt2logo.png" alt="Paper Trader" className="h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                    const isActive = activeView === item.view && (item.id === 'terminal' ? false : true);
                    // Special case: Terminal button logic could be improved, but for now let's simplify.
                    // Actually, let's just make "Dashboard" show the main view and "Terminal" also show main view but maybe we can rename "Dashboard" to "Overview".
                    // For this request, I will map:
                    // Dashboard -> activeView = dashboard
                    // Terminal -> activeView = dashboard (maybe distinguishing later)
                    // History -> activeView = history

                    const isSelected = activeView === item.view;

                    return (

                        <div key={item.id} className="relative group">
                            {isSelected && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-premium-cyan rounded-r-full shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
                            )}
                            <button
                                onClick={() => setActiveView(item.view as any)}
                                className={`w-full flex items-center gap-4 px-6 py-3 transition-all duration-300 ${isSelected
                                    ? 'text-premium-cyan font-bold tracking-wide'
                                    : 'text-gray-500 hover:text-gray-300 font-medium'
                                    }`}
                            >
                                <item.icon
                                    size={22}
                                    className={`transition-all duration-300 ${isSelected ? 'drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]' : 'group-hover:text-gray-200'}`}
                                    strokeWidth={isSelected ? 2.5 : 2}
                                />
                                <span className={isSelected ? '' : 'text-sm'}>{item.label}</span>
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

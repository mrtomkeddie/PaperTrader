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
        { id: 'terminal', label: 'Terminal', icon: Terminal, view: 'dashboard' }, // Maps to Dashboard for now, maybe scroll to terminal?
        { id: 'history', label: 'History', icon: History, view: 'history' },
    ];

    return (
        <div className="hidden md:flex flex-col w-64 h-screen sticky top-0 p-4 border-r border-premium-border bg-black/40 backdrop-blur-xl">
            {/* Logo Area */}
            <div className="flex items-center justify-center p-4 mb-6 mt-2">
                <img src="/pt2logo.png" alt="Paper Trader 2.0" className="h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
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
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.view as any)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${isSelected
                                ? 'bg-premium-cyan/10 text-premium-cyan shadow-[0_0_15px_rgba(0,240,255,0.15)] border border-premium-cyan/20'
                                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                        >
                            {isSelected && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-premium-cyan shadow-[0_0_10px_cyan]" />
                            )}
                            <item.icon size={20} className={`transition-transform duration-300 ${isSelected ? 'scale-110 drop-shadow-[0_0_5px_cyan]' : 'group-hover:scale-110'}`} />
                            <span className="font-medium tracking-wide text-sm">{item.label}</span>
                        </button>
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

                <div className="px-4 py-4 mt-4 border-t border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center shadow-inner">
                            <span className="text-xs font-bold text-gray-400">USR</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-300">Admin User</span>
                            <span className="text-[10px] text-premium-green flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-premium-green animate-pulse"></span>
                                Connected
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

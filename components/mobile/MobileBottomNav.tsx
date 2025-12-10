import React from 'react';
import { BarChart2, Clock } from 'lucide-react';

interface Props {
    activeTab: 'dashboard' | 'trades';
    onTabChange: (tab: 'dashboard' | 'trades') => void;
}

const MobileBottomNav: React.FC<Props> = ({ activeTab, onTabChange }) => {
    return (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
            <div className="bg-[#1C1C1E] border border-white/10 rounded-full p-1.5 flex items-center shadow-2xl pointer-events-auto backdrop-blur-md">
                <button
                    onClick={() => onTabChange('dashboard')}
                    className={`w-20 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                >
                    <BarChart2 size={24} />
                </button>
                <div className="w-[1px] h-8 bg-white/10 mx-1" />
                <button
                    onClick={() => onTabChange('trades')}
                    className={`w-20 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${activeTab === 'trades' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                >
                    <Clock size={24} />
                </button>
            </div>
        </div>
    );
};

export default MobileBottomNav;

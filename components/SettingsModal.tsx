
import React, { useState, useEffect } from 'react';
import { BrokerMode, OandaConfig } from '../types';
import { X, Save, CheckCircle, AlertCircle, Loader2, Server } from 'lucide-react';
import { DEFAULT_REMOTE_URL } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentMode: BrokerMode;
  oandaConfig: OandaConfig;
  onSave: (mode: BrokerMode, config: OandaConfig, remoteUrl?: string) => Promise<boolean>; 
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, currentMode, oandaConfig, onSave }) => {
  const [remoteUrl, setRemoteUrl] = useState(() => {
      if (typeof window !== 'undefined') return localStorage.getItem('remoteUrl') || DEFAULT_REMOTE_URL;
      return DEFAULT_REMOTE_URL;
  });
  
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSave = async () => {
    setStatus('testing');
    try {
         const res = await fetch(`${remoteUrl}/state`);
         if (res.ok) {
             await onSave(BrokerMode.REMOTE_SERVER, oandaConfig, remoteUrl);
             setStatus('success');
             setTimeout(() => onClose(), 1500);
         } else {
             throw new Error("Server error");
         }
    } catch (e) {
         setStatus('error');
         setErrorMsg('Could not connect to Remote Server.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-[#1C1C1E] w-full max-w-md rounded-[24px] border border-white/10 overflow-hidden shadow-2xl relative z-10 animate-fade-in-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h2 className="text-lg font-bold text-white tracking-tight">Connection Settings</h2>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          <div className="flex flex-col items-center justify-center py-4 text-center space-y-2">
             <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-2">
                <Server size={32} />
             </div>
             <h3 className="text-white font-bold">Remote Dashboard Mode</h3>
             <p className="text-xs text-ios-gray max-w-[250px]">
                This app is a viewer for your 24/7 trading bot. Ensure <code>npm run scheduler</code> is running on your computer.
             </p>
          </div>

          {/* Remote Server Input */}
          <div className="space-y-3 animate-fade-in">
                <label className="text-[10px] text-ios-gray ml-1 block">Bot Server URL</label>
                <input 
                    type="text" 
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    placeholder="http://localhost:3001"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
          </div>

          {status === 'error' && (
             <div className="flex items-center gap-2 text-ios-red text-xs font-bold bg-ios-red/10 p-3 rounded-lg animate-pulse">
                <AlertCircle size={14} />
                {errorMsg}
             </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
            <button 
                onClick={handleSave}
                disabled={status === 'testing'}
                className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2
                    ${status === 'success' ? 'bg-ios-green text-white' : 'bg-white text-black hover:bg-neutral-200'}
                `}
            >
                {status === 'testing' && <Loader2 size={18} className="animate-spin" />}
                {status === 'success' && <CheckCircle size={18} />}
                {status === 'idle' && <Save size={18} />}
                {status === 'idle' ? 'Connect to Bot' : status === 'testing' ? 'Connecting...' : status === 'success' ? 'Connected!' : 'Try Again'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

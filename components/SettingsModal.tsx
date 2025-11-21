
import React, { useState } from 'react';
import { BrokerMode, OandaConfig } from '../types';
import { X, CheckCircle, AlertCircle, Loader2, Cloud, Terminal } from 'lucide-react';
import { DEFAULT_REMOTE_URL } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentMode: BrokerMode;
  oandaConfig: OandaConfig;
  onSave: (mode: BrokerMode, config: OandaConfig, remoteUrl?: string) => Promise<boolean>; 
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, oandaConfig, onSave }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState(() => {
      if (typeof window !== 'undefined') return localStorage.getItem('remoteUrl') || DEFAULT_REMOTE_URL;
      return DEFAULT_REMOTE_URL;
  });
  
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleConnect = async (urlToUse: string) => {
    setStatus('testing');
    try {
         const cleanUrl = urlToUse.trim().replace(/\/$/, "");
         const res = await fetch(`${cleanUrl}/state`);
         if (res.ok) {
             await onSave(BrokerMode.REMOTE_SERVER, oandaConfig, cleanUrl);
             setRemoteUrl(cleanUrl);
             setStatus('success');
             setTimeout(() => onClose(), 1500);
         } else {
             throw new Error("Server error");
         }
    } catch (e) {
         setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-[#1C1C1E] w-full max-w-md rounded-[24px] border border-white/10 overflow-hidden shadow-2xl relative z-10 animate-fade-in-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h2 className="text-lg font-bold text-white tracking-tight">Connection Status</h2>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 bg-white/5 rounded-2xl border border-white/5">
             <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 transition-colors ${status === 'error' ? 'bg-ios-red/20 text-ios-red' : 'bg-ios-blue/20 text-ios-blue'}`}>
                <Cloud size={32} />
             </div>
             <div>
                <h3 className="text-white font-bold text-lg">Production Bot</h3>
                <p className="text-xs text-ios-gray mt-1">Hosted on Render Cloud (24/7)</p>
             </div>
             
             {status === 'error' && (
                 <div className="flex items-center gap-2 text-ios-red text-xs font-bold bg-ios-red/10 px-4 py-2 rounded-lg animate-pulse mt-2">
                    <AlertCircle size={14} />
                    Connection Failed
                 </div>
             )}
          </div>

          {/* Main Action Button */}
          <button 
                onClick={() => handleConnect(DEFAULT_REMOTE_URL)}
                disabled={status === 'testing'}
                className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg
                    ${status === 'success' ? 'bg-ios-green text-white' : 'bg-white text-black hover:bg-neutral-200'}
                `}
            >
                {status === 'testing' && <Loader2 size={18} className="animate-spin" />}
                {status === 'success' && <CheckCircle size={18} />}
                {status === 'idle' && <Cloud size={18} />}
                {status === 'idle' ? 'Reconnect to Cloud' : status === 'testing' ? 'Connecting...' : status === 'success' ? 'Connected!' : 'Try Again'}
            </button>

            {/* Advanced Toggle */}
            <div className="pt-2 border-t border-white/5">
                <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between text-xs text-ios-gray py-2 hover:text-white transition-colors"
                >
                    <span className="flex items-center gap-2"><Terminal size={12} /> Advanced Options</span>
                    <span>{showAdvanced ? 'Hide' : 'Show'}</span>
                </button>

                {showAdvanced && (
                    <div className="mt-3 space-y-2 animate-fade-in">
                        <label className="text-[10px] text-ios-gray ml-1">Custom Server URL</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={remoteUrl}
                                onChange={(e) => setRemoteUrl(e.target.value)}
                                className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-ios-blue"
                            />
                            <button 
                                onClick={() => handleConnect(remoteUrl)}
                                className="bg-white/10 px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/20"
                            >
                                Set
                            </button>
                        </div>
                    </div>
                )}
            </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

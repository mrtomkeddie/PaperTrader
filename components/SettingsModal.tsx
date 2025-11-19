
import React, { useState, useEffect } from 'react';
import { BrokerMode, OandaConfig } from '../types';
import { X, Save, ShieldCheck, Globe, Activity, CheckCircle, AlertCircle, Loader2, Trash2, ExternalLink } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentMode: BrokerMode;
  oandaConfig: OandaConfig;
  onSave: (mode: BrokerMode, config: OandaConfig) => Promise<boolean>; 
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, currentMode, oandaConfig, onSave }) => {
  const [mode, setMode] = useState<BrokerMode>(currentMode);
  const [apiKey, setApiKey] = useState(oandaConfig.apiKey);
  const [accountId, setAccountId] = useState(oandaConfig.accountId);
  
  // Sync state when props change (e.g. loaded from localStorage)
  useEffect(() => {
      setMode(currentMode);
      setApiKey(oandaConfig.apiKey);
      setAccountId(oandaConfig.accountId);
  }, [currentMode, oandaConfig]);

  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSave = async () => {
    if (mode === BrokerMode.OANDA_PAPER) {
        setStatus('testing');
        const success = await onSave(mode, { ...oandaConfig, apiKey, accountId });
        if (success) {
            setStatus('success');
            setTimeout(() => onClose(), 1500);
        } else {
            setStatus('error');
            setErrorMsg('Could not connect to Oanda. Check Key/ID.');
        }
    } else {
        onSave(mode, { ...oandaConfig, apiKey, accountId });
        onClose();
    }
  };

  const handleClearData = () => {
      if (confirm('Are you sure you want to delete your saved Oanda API keys?')) {
          setApiKey('');
          setAccountId('');
          localStorage.removeItem('oandaConfig');
          setMode(BrokerMode.SIMULATION_CRYPTO);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-[#1C1C1E] w-full max-w-md rounded-[24px] border border-white/10 overflow-hidden shadow-2xl relative z-10 animate-fade-in-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h2 className="text-lg font-bold text-white tracking-tight">Engine Settings</h2>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Broker Mode Selection */}
          <div>
            <label className="text-xs font-semibold text-ios-gray uppercase tracking-wider mb-3 block">Data Source & Execution</label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setMode(BrokerMode.SIMULATION_CRYPTO)}
                className={`p-3 rounded-xl border transition-all duration-200 text-left relative overflow-hidden
                  ${mode === BrokerMode.SIMULATION_CRYPTO ? 'bg-ios-blue/10 border-ios-blue text-ios-blue' : 'bg-white/5 border-transparent text-ios-gray'}`}
              >
                 <div className="flex items-center gap-2 mb-1">
                    <Activity size={18} />
                    <span className="font-bold text-sm">Crypto Stream</span>
                 </div>
                 <p className="text-[10px] opacity-80">Binance WebSocket. Ideal for BTC/ETH volatility testing.</p>
              </button>

              <button 
                onClick={() => setMode(BrokerMode.OANDA_PAPER)}
                className={`p-3 rounded-xl border transition-all duration-200 text-left relative overflow-hidden
                  ${mode === BrokerMode.OANDA_PAPER ? 'bg-orange-500/10 border-orange-500 text-orange-400' : 'bg-white/5 border-transparent text-ios-gray'}`}
              >
                 <div className="flex items-center gap-2 mb-1">
                    <Globe size={18} />
                    <span className="font-bold text-sm">Oanda Paper</span>
                 </div>
                 <p className="text-[10px] opacity-80">Connect to your Oanda Practice account for Forex/CFDs.</p>
              </button>
            </div>
          </div>

          {/* Oanda Credentials Input */}
          <div className={`space-y-4 transition-all duration-300 ${mode === BrokerMode.OANDA_PAPER ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
             <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-ios-green" />
                    <span className="text-xs font-medium text-white">Oanda Credentials (Stored Locally)</span>
                </div>
                <button onClick={handleClearData} className="text-[10px] text-ios-red flex items-center gap-1 hover:underline">
                    <Trash2 size={10} /> Clear Data
                </button>
             </div>
             
             <div className="space-y-3">
                <div>
                    <div className="flex justify-between items-baseline mb-1">
                         <label className="text-[10px] text-ios-gray ml-1 block">Personal Access Token</label>
                         <a href="https://www.oanda.com/demo-account/tpa/personal_token" target="_blank" rel="noreferrer" className="text-[10px] text-ios-blue flex items-center gap-0.5 hover:underline">
                            Get Key <ExternalLink size={8} />
                         </a>
                    </div>
                    <input 
                        type="password" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Format: xxxxx-xxxxx"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-ios-gray ml-1 block mb-1">Account ID</label>
                    <input 
                        type="text" 
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        placeholder="Format: 001-001-xxxxxxx-001"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                    />
                </div>
             </div>
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
                {status === 'idle' ? 'Save & Test Connection' : status === 'testing' ? 'Verifying...' : status === 'success' ? 'Connected!' : 'Try Again'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

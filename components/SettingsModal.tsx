
import React, { useState } from 'react';
import { BrokerMode, OandaConfig } from '../types';
import { X, CheckCircle, AlertCircle, Loader2, Cloud, Terminal, Bell } from 'lucide-react';
import { DEFAULT_REMOTE_URL, CRYPTO_DEFAULT_REMOTE_URL } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentMode: BrokerMode;
  oandaConfig: OandaConfig;
  onSave: (mode: BrokerMode, config: OandaConfig, remoteUrl?: string) => Promise<boolean>;
  onSetCryptoRemote?: (url: string) => void;
  isIndicesConnected?: boolean;
  isCryptoConnected?: boolean;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, oandaConfig, onSave, onSetCryptoRemote, isIndicesConnected, isCryptoConnected }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('remoteUrl') || DEFAULT_REMOTE_URL;
    return DEFAULT_REMOTE_URL;
  });
  const [cryptoUrl, setCryptoUrl] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('cryptoRemoteUrl');
        if (saved) return saved;
        const envUrl = (import.meta as any)?.env?.VITE_CRYPTO_REMOTE_URL;
        if (envUrl) return envUrl;
        return CRYPTO_DEFAULT_REMOTE_URL;
      }
    } catch { }
    return CRYPTO_DEFAULT_REMOTE_URL;
  });

  const [pushStatus, setPushStatus] = useState<'idle' | 'enabled' | 'error'>('idle');
  const [cryptoSample, setCryptoSample] = useState<string>('');

  if (!isOpen) return null;

  const handleConnect = async (urlToUse: string) => {
    try {
      const cleanUrl = urlToUse.trim().replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/state`);
      if (res.ok) {
        await onSave(BrokerMode.REMOTE_SERVER, oandaConfig, cleanUrl);
        setRemoteUrl(cleanUrl);
      }
    } catch (e) { }
  };

  const handleConnectCrypto = async (urlToUse: string) => {
    try {
      const clean = urlToUse.trim().replace(/\/$/, '');
      const res = await fetch(`${clean}/state`);
      if (!res.ok) throw new Error('Server error');
      try { if (typeof window !== 'undefined') localStorage.setItem('cryptoRemoteUrl', clean); } catch { }
      setCryptoUrl(clean);
      if (onSetCryptoRemote) onSetCryptoRemote(clean);
    } catch { }
  };

  const enablePush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setPushStatus('error'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setPushStatus('error'); return; }
      const vapid = (import.meta as any)?.env?.VITE_VAPID_PUBLIC_KEY;
      if (!vapid) { setPushStatus('error'); return; }
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
      };
      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) });
      const base = (remoteUrl || DEFAULT_REMOTE_URL).replace(/\/$/, "");
      const r1 = await fetch(`${base}/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
      if (r1.ok) setPushStatus('enabled'); else setPushStatus('error');
    } catch { setPushStatus('error'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="bg-[#1C1C1E] w-full max-w-md rounded-[24px] border border-white/10 overflow-hidden shadow-2xl relative z-10 animate-fade-in-up flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h2 className="text-lg font-bold text-white tracking-tight">Connection Status</h2>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">

          <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 bg-white/5 rounded-2xl border border-white/5">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 transition-colors ${!isIndicesConnected ? 'bg-ios-red/20 text-ios-red' : 'bg-ios-blue/20 text-ios-blue'}`}>
              <Cloud size={32} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Production Bot</h3>
              <p className="text-xs text-ios-gray mt-1">Hosted on Render Cloud (24/7)</p>
            </div>

            <div className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg mt-2 ${!isIndicesConnected ? 'text-ios-red bg-ios-red/10' : 'text-ios-green bg-ios-green/10'}`}>
              {isIndicesConnected ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {isIndicesConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          

          {/* Push Notifications */}
          <div className="mt-2">
            <label className="text-[10px] text-ios-gray ml-1">Notifications</label>
            <button
              onClick={enablePush}
              className={`w-full mt-1 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-white/10 ${pushStatus === 'enabled' ? 'bg-ios-green text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              <Bell size={16} /> {pushStatus === 'enabled' ? 'Enabled' : 'Enable Push'}
            </button>
            <p className="text-[10px] text-ios-gray mt-1">On iPhone, open from Home Screen after installing to allow push.</p>
          </div>

          {/* Analytics */}
          <div className="mt-4">
            <label className="text-[10px] text-ios-gray ml-1">Analytics</label>
            <a
              href={`${(remoteUrl || DEFAULT_REMOTE_URL).replace(/\/$/, '')}/export/csv?status=closed`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full mt-1 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-white/10 bg-white/10 text-white hover:bg-white/20"
            >
              Export Closed Trades CSV
            </a>
          </div>

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

          <div className="pt-4 text-center">
            <p className="text-[10px] text-ios-gray/50">v2.1.0 (Stabilized)</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

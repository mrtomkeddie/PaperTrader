
import React, { useState } from 'react';
import { BrokerMode, OandaConfig } from '../types';
import { X, CheckCircle, AlertCircle, Loader2, Cloud, Terminal, Bell, Download } from 'lucide-react';
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
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('remoteUrl');
        if (saved) return saved;
        const hostIsLocal = window.location && window.location.hostname === 'localhost';
        if (hostIsLocal) return 'http://localhost:3001';
        return DEFAULT_REMOTE_URL;
      }
    } catch { }
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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [rebootStatus, setRebootStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

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

  const handleRestartIndices = async () => {
    try {
      setRebootStatus('loading');
      const base = (remoteUrl || DEFAULT_REMOTE_URL).replace(/\/$/, "");
      const res = await fetch(`${base}/restart`, { method: 'POST' });
      if (res.ok) {
        setRebootStatus('success');
        setTimeout(() => setRebootStatus('idle'), 3000);
      } else {
        setRebootStatus('error');
        setTimeout(() => setRebootStatus('idle'), 3000);
      }
    } catch {
      setRebootStatus('error');
      setTimeout(() => setRebootStatus('idle'), 3000);
    }
  };

  const enablePush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setPushStatus('error'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setPushStatus('error'); return; }
      const base = (remoteUrl || DEFAULT_REMOTE_URL).replace(/\/$/, "");
      let vapid = (import.meta as any)?.env?.VITE_VAPID_PUBLIC_KEY as string | undefined;
      try {
        const cfg = await fetch(`${base}/push/config`, { cache: 'no-store' });
        if (cfg.ok) { const j = await cfg.json(); if (j && j.publicKey) vapid = j.publicKey; }
      } catch { }
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
      const r1 = await fetch(`${base}/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
      if (r1.ok) setPushStatus('enabled'); else setPushStatus('error');
    } catch { setPushStatus('error'); }
  };

  const testPush = async () => {
    try {
      const base = (remoteUrl || DEFAULT_REMOTE_URL).replace(/\/$/, "");
      await fetch(`${base}/push/test`, { method: 'POST' });
    } catch { }
  };

  const handleResetTrades = async () => {
    try {
      setResetStatus('loading');
      const base = (remoteUrl || DEFAULT_REMOTE_URL).replace(/\/$/, "");
      const res = await fetch(`${base}/cloud/clear`, { method: 'POST' });
      if (res.ok) {
        setResetStatus('success');
        setShowResetConfirm(false);
        // Reload the page to show cleared state
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setResetStatus('error');
      }
    } catch {
      setResetStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      <div className="bg-premium-card w-full max-w-md rounded-2xl border border-premium-border overflow-hidden shadow-glass relative z-10 animate-slide-up flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-premium-border flex justify-between items-center bg-premium-bg/50">
          <h2 className="text-lg font-bold text-white tracking-tight font-mono uppercase">Connection Status</h2>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">

          <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 bg-white/5 rounded-2xl border border-premium-border/50 shadow-inner">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 transition-colors ${!isIndicesConnected ? 'bg-premium-red/20 text-premium-red' : 'bg-premium-cyan/20 text-premium-cyan shadow-glow-cyan/50'}`}>
              <Cloud size={32} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg font-mono tracking-wide">Production Bot</h3>
              <p className="text-xs text-gray-400 mt-1">Hosted on Render Cloud (24/7)</p>
            </div>

            <div className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg mt-2 ${!isIndicesConnected ? 'text-premium-red bg-premium-red/10' : 'text-premium-green bg-premium-green/10 border border-premium-green/20'}`}>
              {isIndicesConnected ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {isIndicesConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>



          {/* Push Notifications */}
          <div className="mt-2">
            <label className="text-[10px] text-ios-gray ml-1">Notifications</label>
            <button
              onClick={enablePush}
              className={`w-full mt-1 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-premium-border ${pushStatus === 'enabled' ? 'bg-premium-green text-black font-mono' : 'bg-premium-bg/50 text-white hover:bg-white/10'}`}
            >
              <Bell size={16} /> {pushStatus === 'enabled' ? 'Enabled' : 'Enable Push'}
            </button>
            <div className="mt-2 flex justify-between gap-2">
              <button onClick={testPush} className="w-1/2 font-bold py-2 rounded-xl border border-white/5 bg-white/5 text-white hover:bg-white/10 text-xs">
                Send Test Push
              </button>
              <a href="/sw.js" target="_blank" className="w-1/2 text-center font-bold py-2 rounded-xl border border-white/5 bg-white/5 text-white hover:bg-white/10 text-xs">Service Worker</a>
            </div>
            <p className="text-[10px] text-ios-gray mt-1">On iPhone, install to Home Screen and open from there to enable push.</p>
          </div>

          {/* Analytics */}
          <div className="mt-4">
            <label className="text-[10px] text-ios-gray ml-1">Data Management</label>
            <a
              href={`${(remoteUrl || DEFAULT_REMOTE_URL).replace(/\/$/, '')}/export/csv?status=ALL`}
              download="trades.csv"
              className="w-full mt-1 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-white/5 bg-white/5 text-white hover:bg-white/10"
            >
              <Download size={16} /> Export Trade History (CSV)
            </a>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full mt-2 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-premium-red/30 bg-premium-red/10 text-premium-red hover:bg-premium-red/20 hover:shadow-glow-red/30"
            >
              Reset All Trades
            </button>
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
                <label className="text-[10px] text-ios-gray ml-1">Custom Server URL (Indices)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    className="flex-1 bg-black/50 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-ios-blue"
                  />
                  <button
                    onClick={() => handleConnect(remoteUrl)}
                    className="bg-white/5 px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/10"
                  >
                    Set
                  </button>
                </div>

                <label className="text-[10px] text-ios-gray ml-1 mt-2 block">Crypto Bot URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cryptoUrl}
                    onChange={(e) => setCryptoUrl(e.target.value)}
                    className="flex-1 bg-black/50 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-ios-blue"
                  />
                  <button
                    onClick={() => handleConnectCrypto(cryptoUrl)}
                    className="bg-white/5 px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/10"
                  >
                    Set
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5">
                  <button
                    onClick={handleRestartIndices}
                    disabled={rebootStatus === 'loading'}
                    className={`w-full font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border ${rebootStatus === 'error' ? 'border-ios-red/30 bg-ios-red/10 text-ios-red' : rebootStatus === 'success' ? 'border-ios-green/30 bg-ios-green/10 text-ios-green' : 'border-white/5 bg-white/5 text-white hover:bg-white/10'}`}
                  >
                    {rebootStatus === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Terminal size={16} />}
                    {rebootStatus === 'loading' ? 'Restarting Bot...' : rebootStatus === 'success' ? 'Restart Signal Sent' : rebootStatus === 'error' ? 'Restart Failed' : 'Restart Indices Bot'}
                  </button>
                  <p className="text-[10px] text-ios-gray mt-1 text-center">Use this if the bot appears frozen.</p>
                </div>

              </div>
            )}
          </div>

          <div className="pt-4 text-center">
            <p className="text-[10px] text-ios-gray/50">v2.1.0 (Stabilized)</p>
          </div>

        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)} />
          <div className="bg-[#13141b] w-full max-w-sm rounded-2xl border border-white/5 overflow-hidden shadow-2xl relative z-10 animate-fade-in-up">
            <div className="p-6 space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-ios-red/20 text-ios-red flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Reset All Trades?</h3>
                <p className="text-sm text-ios-gray mb-4">
                  This will permanently delete all trade history (open and closed) from the server, local storage, and cloud.
                </p>
                <div className="bg-ios-red/10 border border-ios-red/30 rounded-xl p-3 mb-4">
                  <p className="text-xs text-ios-red font-semibold">
                    ⚠️ Have you exported your data? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetStatus === 'loading'}
                  className="flex-1 font-bold py-3 rounded-xl border border-white/5 bg-white/5 text-white hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetTrades}
                  disabled={resetStatus === 'loading'}
                  className="flex-1 font-bold py-3 rounded-xl bg-ios-red text-white hover:bg-ios-red/80 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {resetStatus === 'loading' ? (
                    <><Loader2 size={16} className="animate-spin" /> Resetting...</>
                  ) : (
                    'Confirm Reset'
                  )}
                </button>
              </div>
              {resetStatus === 'error' && (
                <p className="text-xs text-ios-red text-center">Failed to reset. Please try again.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsModal;

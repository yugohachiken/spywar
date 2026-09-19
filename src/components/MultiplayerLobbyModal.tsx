import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Users,
  ArrowRight,
  Loader2,
  Play,
  Sparkles,
  LogIn,
  LogOut,
  CheckCircle,
  AlertCircle,
  X,
  Copy,
  Check,
  ExternalLink,
  Mail,
  Key,
  Shield,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  UserCheck
} from 'lucide-react';
import { createMultiplayerRoom, joinMultiplayerRoom } from '../services/multiplayerService';
import {
  subscribeToAuth,
  signInWithGoogle,
  signInWithGoogleRedirect,
  checkRedirectAuthResult,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  auth,
  FIREBASE_PROJECT_ID
} from '../firebase';
import { EngineConfig } from '../engine/SpywarEngine';
import { MultiplayerRoomDoc } from '../types/spywar';
import { User } from 'firebase/auth';

interface MultiplayerLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: EngineConfig;
  onRoomJoined: (roomDoc: MultiplayerRoomDoc, myPid: 'P1' | 'P2', myName: string) => void;
  initialRoomCode?: string;
}

function extractErrorMessage(err: any): string {
  if (!err) return 'Unknown error occurred.';
  const msg = err.message || (typeof err === 'string' ? err : '');
  try {
    const parsed = JSON.parse(msg);
    if (parsed && typeof parsed.error === 'string') {
      return parsed.error;
    }
  } catch {}
  return msg || 'Failed to complete request.';
}

export const MultiplayerLobbyModal: React.FC<MultiplayerLobbyModalProps> = ({
  isOpen,
  onClose,
  config,
  onRoomJoined,
  initialRoomCode = ''
}) => {
  const [tab, setTab] = useState<'create' | 'join'>(initialRoomCode ? 'join' : 'create');
  const [agentName, setAgentName] = useState(() => {
    return localStorage.getItem('spywar_agent_name') || `Agent ${Math.floor(Math.random() * 900 + 100)}`;
  });
  const [roomCodeInput, setRoomCodeInput] = useState(initialRoomCode);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);

  // Authentication & account settings state
  const [showAccountOptions, setShowAccountOptions] = useState(false);
  const [authMode, setAuthMode] = useState<'google' | 'email'>('google');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isRegisteringEmail, setIsRegisteringEmail] = useState(false);
  const [showDomainHelp, setShowDomainHelp] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const isExternalDomain = currentHostname !== 'localhost' &&
    !currentHostname.includes('.run.app') &&
    !currentHostname.includes('.firebaseapp.com');

  // Declared before any useEffect or handlers to prevent TDZ ReferenceErrors
  const saveName = useCallback((name: string) => {
    setAgentName(name);
    try {
      localStorage.setItem('spywar_agent_name', name);
    } catch {}
  }, []);

  const copyCurrentDomain = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentHostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  const openInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAuthError = useCallback((err: any) => {
    console.error('Authentication Error:', err);
    const code = err?.code || '';
    const message = err?.message || '';

    if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
      setShowDomainHelp(true);
      setAuthNotice(`Domain Not Whitelisted: "${currentHostname}" is an external domain not on the Firebase whitelist. You can still play immediately with your Operative Call-Sign below!`);
    } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      if (isInIframe) {
        setAuthNotice('Popup blocked or closed by iframe security. You can play directly below without Google sign-in, or open this game in a new tab.');
      } else if (isExternalDomain) {
        setShowDomainHelp(true);
        setAuthNotice('Google sign-in closed. On external domains, Google OAuth requires domain whitelisting. You can play directly below without Google sign-in!');
      } else {
        setAuthNotice('Google sign-in window was closed by the browser or popup blocker. You can play right away with your Operative Call-Sign below.');
      }
    } else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      setError('Invalid email or password.');
    } else if (code === 'auth/email-already-in-use') {
      setError('An account with this email already exists. Try signing in instead.');
    } else if (code === 'auth/weak-password') {
      setError('Password should be at least 6 characters.');
    } else {
      setAuthNotice(message || 'Sign-in window closed. You can proceed as a Guest Operative without signing in.');
    }
  }, [currentHostname, isExternalDomain, isInIframe]);

  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      setCurrentUser(user);
      if (user?.displayName && (!localStorage.getItem('spywar_agent_name') || agentName.startsWith('Agent '))) {
        saveName(user.displayName);
      }
    });
    return () => unsub();
  }, [agentName, saveName]);

  // Check if returning from Google Redirect Auth
  useEffect(() => {
    checkRedirectAuthResult().then((user) => {
      if (user) {
        setCurrentUser(user);
        if (user.displayName) {
          saveName(user.displayName);
        }
      }
    }).catch((err) => {
      handleAuthError(err);
    });
  }, [handleAuthError, saveName]);

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCodeInput(initialRoomCode.toUpperCase());
      setTab('join');
    }
  }, [initialRoomCode]);

  const handleGoogleSignInPopup = async () => {
    setAuthLoading(true);
    setError(null);
    setAuthNotice(null);
    try {
      const user = await signInWithGoogle();
      setCurrentUser(user);
      if (user.displayName) {
        saveName(user.displayName);
      }
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignInRedirect = async () => {
    setAuthLoading(true);
    setError(null);
    setAuthNotice(null);
    try {
      await signInWithGoogleRedirect();
    } catch (err: any) {
      handleAuthError(err);
      setAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    setAuthLoading(true);
    setError(null);
    setAuthNotice(null);
    try {
      let user: User;
      if (isRegisteringEmail) {
        user = await signUpWithEmail(emailInput, passwordInput);
      } else {
        user = await signInWithEmail(emailInput, passwordInput);
      }
      setCurrentUser(user);
      if (emailInput.includes('@')) {
        saveName(emailInput.split('@')[0]);
      }
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreate = async () => {
    if (!agentName.trim()) {
      setError('Please enter your Agent Call-Sign.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      saveName(agentName.trim());
      const { roomDoc } = await createMultiplayerRoom(agentName.trim(), config);
      onRoomJoined(roomDoc, 'P1', agentName.trim());
    } catch (err: any) {
      console.error('Room creation failed:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!agentName.trim()) {
      setError('Please enter your Agent Call-Sign.');
      return;
    }
    if (!roomCodeInput.trim()) {
      setError('Please enter a 6-character room code.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      saveName(agentName.trim());
      const cleanCode = roomCodeInput.trim().toUpperCase();
      const roomDoc = await joinMultiplayerRoom(cleanCode, agentName.trim());
      onRoomJoined(roomDoc, 'P2', agentName.trim());
    } catch (err: any) {
      console.error('Room join failed:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              Online Multiplayer
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live Cloud Sync
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Encrypted real-time matches across devices with zero setup.
            </p>
          </div>
        </div>

        {/* Iframe Notice (if embedded in preview) */}
        {isInIframe && (
          <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/30 flex items-center justify-between text-xs text-blue-200">
            <span className="text-[11px] leading-tight">Running in preview window.</span>
            <button
              type="button"
              onClick={openInNewTab}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 shrink-0 underline"
            >
              <span>Open in New Tab</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Notice for Google popup / browser blocking */}
        {authNotice && (
          <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs space-y-1.5 animate-in fade-in">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-snug text-[11px]">{authNotice}</div>
            </div>
            <div className="text-[10px] text-amber-300/80 pl-6 font-medium">
              Ready to play? Just enter your call-sign below and click &quot;Create Match&quot;!
            </div>
          </div>
        )}

        {/* Agent Call-Sign Input (Core identity for the match) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              Your Operative Call-Sign
            </span>
            <span className="text-[10px] font-mono text-zinc-500">Visible to Opponent</span>
          </label>
          <input
            type="text"
            maxLength={24}
            value={agentName}
            onChange={(e) => saveName(e.target.value)}
            placeholder="e.g. Agent 007, Cipher, Ghost"
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors font-mono font-semibold"
          />
        </div>

        {/* Tabs: Create Match vs Join with Code */}
        <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => { setTab('create'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              tab === 'create'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Create Match</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('join'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              tab === 'join'
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>Join with Code</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs font-mono flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-snug">{error}</div>
          </div>
        )}

        {/* Tab Content: Create Room */}
        {tab === 'create' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs space-y-1.5">
              <div className="font-semibold text-zinc-300 flex items-center justify-between">
                <span>Rules Preset:</span>
                <span className="text-[10px] font-mono text-amber-400 font-bold">{config.rounds} Rounds Match</span>
              </div>
              <p className="text-zinc-400 text-[11px] leading-relaxed font-mono">
                {config.cardsDrawnPerTurn} cards/turn &bull; Cap: {config.affiliationMaxCap} coins &bull; {config.maxMissionsInPlay === 0 ? 'Unlimited' : config.maxMissionsInPlay} Missions
              </p>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleCreate}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs tracking-wide shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Provisioning Match Room...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Create Room &amp; Get Invite Code</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab Content: Join Room */}
        {tab === 'join' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>Room Code</span>
                <span className="text-[10px] font-mono text-zinc-500">6-character code</span>
              </label>
              <input
                type="text"
                maxLength={8}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. SPY482"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-center text-xl font-mono font-bold tracking-widest text-amber-400 focus:outline-none focus:border-amber-500 uppercase placeholder:text-zinc-700"
              />
            </div>

            <button
              type="button"
              disabled={loading || !roomCodeInput.trim()}
              onClick={handleJoin}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Joining Match...</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  <span>Infiltrate &amp; Join Room</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Account & Profile Badge (Optional Linking) */}
        <div className="border-t border-zinc-800 pt-3">
          {currentUser ? (
            <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="" className="w-6 h-6 rounded-full border border-zinc-700 shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-200 truncate text-[11px]">
                    {currentUser.displayName || currentUser.email || 'Verified Operative'}
                  </p>
                  <p className="text-[10px] text-emerald-400/90 font-mono">
                    {currentUser.email ? currentUser.email : 'Google Account Linked'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-[10px] font-mono flex items-center gap-1 shrink-0 border border-zinc-700 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                <span>Disconnect</span>
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setShowAccountOptions(!showAccountOptions)}
                className="w-full flex items-center justify-between text-[11px] text-zinc-400 hover:text-zinc-200 py-1 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Account Status: <strong className="text-zinc-300">Guest Operative (Active)</strong></span>
                </span>
                <span className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300">
                  <span>{showAccountOptions ? 'Hide' : 'Link Google/Email (Optional)'}</span>
                  {showAccountOptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </span>
              </button>

              {showAccountOptions && (
                <div className="mt-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-zinc-300">Link Permanent Profile</span>
                    <span className="text-[10px] font-mono text-zinc-500">Optional</span>
                  </div>

                  {/* Toggle Google vs Email */}
                  <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setAuthMode('google')}
                      className={`py-1 rounded transition-all flex items-center justify-center gap-1 ${
                        authMode === 'google' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Google
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('email')}
                      className={`py-1 rounded transition-all flex items-center justify-center gap-1 ${
                        authMode === 'email' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Email &amp; Password
                    </button>
                  </div>

                  {/* Google Option */}
                  {authMode === 'google' && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={authLoading}
                        onClick={handleGoogleSignInPopup}
                        className="w-full py-2 px-3 rounded-lg bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                      >
                        {authLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                          </svg>
                        )}
                        <span>Sign in with Google</span>
                      </button>

                      <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        <span>Window closing or blocked?</span>
                        <button
                          type="button"
                          onClick={handleGoogleSignInRedirect}
                          disabled={authLoading}
                          className="text-blue-400 hover:text-blue-300 underline font-medium"
                        >
                          Try Redirect Flow
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Email Option */}
                  {authMode === 'email' && (
                    <form onSubmit={handleEmailAuth} className="space-y-2">
                      <div className="space-y-1">
                        <div className="relative">
                          <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                          <input
                            type="email"
                            required
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            placeholder="operative@domain.com"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                          />
                        </div>
                        <div className="relative">
                          <Key className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                          <input
                            type="password"
                            required
                            minLength={6}
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="Password (min 6 chars)"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={authLoading}
                          className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          {authLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>{isRegisteringEmail ? 'Create Account' : 'Sign In'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsRegisteringEmail(!isRegisteringEmail)}
                          className="text-[10px] text-zinc-400 hover:text-zinc-200 underline px-1"
                        >
                          {isRegisteringEmail ? 'Sign in instead' : 'New account?'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Vercel Whitelist Guide (Collapsed) */}
                  <div className="border-t border-zinc-800/80 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDomainHelp(!showDomainHelp)}
                      className="w-full flex items-center justify-between text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      <span className="flex items-center gap-1 text-amber-400/90 font-medium">
                        <ShieldAlert className="w-3 h-3" />
                        Domain &amp; Whitelist Info
                      </span>
                      {showDomainHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {showDomainHelp && (
                      <div className="mt-2 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] space-y-2 text-zinc-400">
                        <p className="leading-relaxed">
                          Your current host: <code className="text-amber-300 font-mono bg-zinc-950 px-1 py-0.5 rounded">{currentHostname}</code>
                        </p>
                        <button
                          type="button"
                          onClick={copyCurrentDomain}
                          className="py-1 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-mono flex items-center gap-1 border border-zinc-700"
                        >
                          {copiedDomain ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedDomain ? 'Copied' : 'Copy Hostname'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Line with Version Number */}
        <div className="border-t border-zinc-800/80 pt-2.5 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <span>SPYWAR Online Channel</span>
          <span className="text-zinc-400 font-semibold bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
            v1.2.0
          </span>
        </div>
      </div>
    </div>
  );
};

'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { AuthMFAEnrollResponse, SupabaseClient } from '@supabase/supabase-js';
import { ArrowRight, ArrowUpRight, Check, Copy, Eye, EyeOff, Fingerprint, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import type { AccessReceipt } from '@/lib/access';

type Enrollment = Extract<NonNullable<AuthMFAEnrollResponse['data']>, { type: 'totp' }>;
type Step = 'credentials' | 'setup' | 'verify' | 'access' | 'complete';

export function AuthPanel() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [step, setStep] = useState<Step>('credentials');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [receipt, setReceipt] = useState<AccessReceipt | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  async function openWorkspace(client: SupabaseClient) {
    setStep('access');
    const { data, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!data.session) throw new Error('Your session expired. Sign out and try again.');
    const response = await fetch('/api/access', { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store' });
    if (!response.ok) {
      const failure: { error: string } = await response.json();
      throw new Error(failure.error);
    }
    const accessReceipt: AccessReceipt = await response.json();
    setReceipt(accessReceipt);
    setEnrollment(null);
    setCode('');
    setStep('complete');
  }

  async function continueSession(client: SupabaseClient) {
    const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;
    if (assurance.currentLevel === 'aal2') return openWorkspace(client);
    const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
    if (factorError) throw factorError;
    const factor = factors.totp[0];
    if (factor) {
      setFactorId(factor.id);
      setStep('verify');
    } else {
      setStep('setup');
    }
  }

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    async function restore() {
      try {
        const client = getSupabaseClient();
        setSupabase(client);
        const { error: initializationError } = await client.auth.initialize();
        if (initializationError) throw initializationError;
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        if (data.session) {
          setEmail(data.session.user.email ?? '');
          await continueSession(client);
        }
        const { data: listener } = client.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') {
            setStep('credentials');
            setMode('signin');
            setPassword('');
            setShowPassword(false);
            setReceipt(null);
            setEnrollment(null);
            setCode('');
          }
        });
        unsubscribe = () => listener.subscription.unsubscribe();
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : 'Could not connect to authentication.');
      } finally {
        if (active) setBusy(false);
      }
    }
    void restore();
    return () => { active = false; unsubscribe?.(); };
  }, []);

  async function signInWithGoogle() {
    if (!supabase) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
      });
      if (signInError) throw signInError;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not sign in with Google. Please try again.');
      setBusy(false);
    }
  }

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data, error: authError } = mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      setPassword('');
      if (!data.session) {
        setNotice('Check your email to confirm your account, then come back and sign in.');
        setMode('signin');
        return;
      }
      await continueSession(supabase);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Sign-in failed. Please try again.');
    } finally { setBusy(false); }
  }

  async function enroll() {
    if (!supabase) return;
    setBusy(true); setError('');
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      for (const factor of factors.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'unverified' && factor.friendly_name === 'Entré authenticator')) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removeError) throw removeError;
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Entré authenticator', issuer: 'Entre' });
      if (enrollError) throw enrollError;
      setEnrollment(data);
      setFactorId(data.id);
      setCopied(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not create your authenticator QR code.');
    } finally { setBusy(false); }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError('');
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) throw verifyError;
      await openWorkspace(supabase);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Verification failed. Try the newest code from your authenticator.');
    } finally { setBusy(false); }
  }

  async function signOut() {
    if (!supabase) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      setStep('credentials'); setReceipt(null); setEnrollment(null); setCode(''); setFactorId('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not sign out. Please try again.');
    } finally { setBusy(false); }
  }

  async function copySecret() {
    if (!enrollment) return;
    try { await navigator.clipboard.writeText(enrollment.totp.secret); setCopied(true); }
    catch { setError('Clipboard access is unavailable. Select and copy the setup key below.'); }
  }

  const progress = step === 'credentials' ? 0 : step === 'complete' ? 2 : 1;

  return (
    <div className="mx-auto w-full max-w-[400px]">
      <nav aria-label="Sign-in progress" className="mb-11 flex items-center gap-3 text-[10px]">
        {['YOUR ACCOUNT', 'SECOND FACTOR', 'YOU’RE IN'].map((label, index) => <div key={label} className={`flex items-center gap-2 ${index > progress ? 'text-[#a4aaa0]' : 'text-[#344c3d]'}`}>
          {index > 0 && <span className="mr-1 h-px w-5 bg-[#d8dcd3]" />}
          <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${index <= progress ? 'border-[#344c3d] bg-[#344c3d] text-white' : 'border-[#cdd2c8]'}`}>{index < progress ? <Check size={11} /> : index + 1}</span>
          <span className="tracking-[.04em]">{label}</span>
        </div>)}
      </nav>

      <div key={step + mode} className="auth-content">
        {step === 'credentials' && <>
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full border border-[#d9ded3]"><Fingerprint size={23} strokeWidth={1.3} /></div>
          <h2 className="auth-title">{mode === 'signin' ? <>Welcome<br />to your space.</> : <>Make yourself<br />at home.</>}</h2>
          <p className="mt-5 mb-8 text-sm leading-6 text-[#7a8177]">{mode === 'signin' ? 'One familiar face. Two layers of security.' : 'Your own little corner. Protected from the start.'}</p>
          <button type="button" className="flex w-full items-center justify-center gap-3 rounded-[3px] border border-[#d8dcd3] bg-white px-5 py-4 text-sm transition-colors hover:bg-[#edf1e9]" onClick={signInWithGoogle} disabled={busy || !supabase}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.25c1.9-1.75 2.97-4.33 2.97-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.63-2.41l-3.25-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.04v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.04a10 10 0 0 0 0 9.02l3.36-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.96 5.49l3.36 2.59C7.19 7.72 9.4 5.96 12 5.96Z"/></svg>
            Continue with Google
          </button>
          <div className="my-6 flex items-center gap-4 text-[11px] text-[#7a8177]"><span className="h-px flex-1 bg-[#d8dcd3]" />or continue with email<span className="h-px flex-1 bg-[#d8dcd3]" /></div>
          <form onSubmit={authenticate} className="space-y-5">
            <div><label htmlFor="email" className="mb-2 block text-xs">Email address</label><input className="field" id="email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} /></div>
            <div><label htmlFor="password" className="mb-2 block text-xs">Password</label><div className="relative"><input className="field pr-12" id="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 8 : undefined} required placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-4 text-[#7a8177]" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
            <button className="primary mt-7" disabled={busy || !supabase}>{busy ? 'Connecting…' : mode === 'signup' ? 'Create your account' : 'Continue'}<ArrowRight size={17} strokeWidth={1.5} /></button>
          </form>
          <p className="mt-6 text-center text-xs text-[#7a8177]">{mode === 'signin' ? 'First time here?' : 'Already have a space?'} <button disabled={busy} className="ml-1 border-b border-[#768575] pb-0.5 text-[#344c3d]" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice(''); }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p>
        </>}

        {step === 'setup' && <>
          <h2 className="auth-title">Set up two-factor<br />authentication.</h2>
          <p className="mt-5 mb-6 text-sm leading-6 text-[#7a8177]">Connect an authenticator app to secure your account. You’ll use it to generate a verification code when you sign in.</p>
          {enrollment ? <>
            <div className="mb-6 flex items-center gap-5">
              <div className="qr-frame shrink-0"><img src={enrollment.totp.qr_code} alt="Scan this QR code with your authenticator app" width={160} height={160} /></div>
              <div className="text-xs leading-5"><span className="micro text-[#84917c]">01 / CONNECT</span><p className="mt-2">Open Drip Authenticator.<br />Tap the + hat to add a service.<br />Scan this QR code.</p></div>
            </div>
            <details className="mb-6 text-xs text-[#75806e]"><summary className="cursor-pointer">Can’t scan? Use a setup key</summary><div className="mt-3 rounded border border-[#d8dcd3] p-3"><code className="break-all text-[#344c3d]">{enrollment.totp.secret}</code><button onClick={copySecret} type="button" className="mt-3 flex items-center gap-2">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy setup key'}</button></div></details>
          </> : <button className="primary mb-6" onClick={enroll} disabled={busy}>{busy ? 'Creating your QR code…' : 'Connect authenticator app'}<ArrowUpRight size={17} /></button>}
        </>}

        {step === 'verify' && <>
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full border border-[#d9ded3]"><LockKeyhole size={21} strokeWidth={1.3} /></div>
          <h2 className="auth-title">Verify<br />it’s you.</h2>
          <p className="mt-5 mb-8 text-sm leading-6 text-[#7a8177]">Enter the six-digit code from your authenticator app to finish signing in.</p>
          <p className="mb-6 truncate text-xs text-[#344c3d]">{email}</p>
        </>}

        {(step === 'verify' || (step === 'setup' && enrollment)) && <form onSubmit={verify} className="space-y-4">
          <label htmlFor="code" className="block text-xs">{step === 'setup' ? '02 / Confirm your six-digit code' : 'Authentication code'}</label>
          <input id="code" className="field code-field" aria-describedby="code-help" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} minLength={6} required placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} />
          <p id="code-help" className="text-[11px] leading-5 text-[#7a8177]">Codes refresh every 30 seconds. Use the latest one.</p>
          <button className="primary" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : step === 'setup' ? 'Verify & enter' : 'Enter your space'}<ArrowRight size={17} /></button>
        </form>}

        {step === 'access' && <>
          <h2 className="auth-title">Opening<br />your space.</h2>
          <p className="my-6 text-sm text-[#7a8177]">Confirming your secure session with the server.</p>
          {!busy && <button className="primary" onClick={async () => {
            if (!supabase) return;
            setBusy(true); setError('');
            try { await openWorkspace(supabase); }
            catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not open your space.'); }
            finally { setBusy(false); }
          }}>Try again<ArrowRight size={17} /></button>}
        </>}

        {step === 'complete' && receipt && <>
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#e2ead9]"><Check size={28} strokeWidth={1.4} /></div>
          <h2 className="auth-title">You’re in.<br />Make it yours.</h2>
          <p className="mt-5 mb-8 text-sm leading-6 text-[#7a8177]">Your identity, confirmed.<br />Your space, protected.</p>
          <div className="mb-8 rounded border border-[#d8ded1] p-5 text-xs">
            <div className="mb-5 flex items-center justify-between"><span className="micro text-[#788572]">YOUR SESSION</span><span className="flex items-center gap-1.5 rounded-full bg-[#e3ebdb] px-2 py-1 text-[10px]"><ShieldCheck size={12} /> VERIFIED</span></div>
            <p className="mb-5 break-all text-sm">{receipt.email}</p>
            <div className="flex items-center justify-between border-t border-[#d8ded1] pt-4 text-[#77816f]"><span>Two-factor authentication</span><span className="text-[#344c3d]">Active</span></div>
          </div>
          <button className="primary" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}<LogOut size={16} /></button>
          <p className="mt-4 text-center text-[11px] leading-5 text-[#7a8177]">Your authenticator stays connected for your next visit.</p>
        </>}
      </div>

      {error && <p role="alert" className="mt-5 rounded border border-[#d8bcb2] bg-[#f3e9e4] p-3 text-xs leading-5 text-[#8c4230]">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded border border-[#cad9c2] p-3 text-xs leading-5">{notice}</p>}
      {step !== 'credentials' && step !== 'complete' && <button disabled={busy} className="mt-6 text-xs text-[#7a8177] underline underline-offset-4" onClick={signOut}>Use another account</button>}

      <div className="mt-10 border-t border-[#d8dcd3] pt-5">
        <button onClick={() => setShowHelp(!showHelp)} aria-expanded={showHelp} className="flex w-full items-center justify-between text-xs text-[#75806e]"><span className="flex items-center gap-2"><ShieldCheck size={15} strokeWidth={1.4} /> A little extra security. A lot more peace of mind.</span><span className="ml-2">{showHelp ? '−' : '+'}</span></button>
        {showHelp && <p className="mt-4 text-xs leading-6 text-[#7a8177]">Sign in with Google or your email and password, then verify with your authenticator app. On your first visit, scan the QR code to connect your authenticator. After that, just enter its current six-digit code when you sign in.</p>}
      </div>
    </div>
  );
}

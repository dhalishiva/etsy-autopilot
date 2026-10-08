import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) setError(error.message);
    else setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase!.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError('That code didn’t work. Check the latest email, or send a new code.');
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-extrabold">Etsy Autopilot</h1>
        <p className="mt-2 text-slate">Make digital products, list them on Etsy, and review everything before it goes live.</p>
        {step === 'email' ? (
          <form onSubmit={sendCode} className="mt-8">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <button className="btn-primary mt-4 w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a sign-in code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="mt-8">
            <p className="mb-3 text-sm text-slate">We sent a code to {email}. You can also tap the link in that email.</p>
            <label className="label" htmlFor="code">
              Sign-in code
            </label>
            <input id="code" inputMode="numeric" required className="field tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn-primary mt-4 w-full" disabled={busy}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button type="button" className="btn-quiet mt-2 w-full" onClick={() => setStep('email')}>
              Use a different email
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

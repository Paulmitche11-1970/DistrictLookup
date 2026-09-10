'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, ArrowRight, ArrowLeft, Download } from 'lucide-react';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Brand } from './lookup';
type Mode = 'login' | 'setup' | 'enroll' | 'verify';
export default function AuthForm({ mode }: { mode: Mode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [setupToken, setSetupToken] = useState('');
  useEffect(() => {
    if (mode === 'login')
      fetch('/api/auth/status')
        .then((r) => r.json())
        .then((d) => setSetupRequired(d.setupRequired))
        .catch(() =>
          setError('The sign-in service could not be reached. Please reload.'),
        );
    if (mode === 'setup') {
      const token = new URLSearchParams(location.hash.slice(1)).get('setup');
      if (token) {
        setSetupToken(token);
        history.replaceState(null, '', location.pathname);
      }
    }
    if (mode === 'enroll')
      fetch('/api/auth/enroll')
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          setQr(d.qr);
          setSecret(d.secret);
        })
        .catch((e) => setError(e.message));
  }, [mode]);
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (mode === 'setup' && body.password !== body.confirm)
        throw Error('The passwords do not match.');
      const r = await fetch('/api/auth/' + mode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, code, recovery, setupToken }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (d.recoveryCodes) {
        setCodes(d.recoveryCodes);
      } else location.assign(d.next || '/admin');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const titles = {
    login: 'Welcome back',
    setup: 'Set up agency access',
    enroll: 'Add two-factor authentication',
    verify: 'Verify it’s you',
  };
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand />
        {codes.length ? (
          <>
            <h1>Save your recovery codes</h1>
            <p className="muted small">
              Each code works once if you lose access to your authenticator.
              Store these somewhere safe.
            </p>
            <div className="recovery-codes" style={{ margin: '22px 0' }}>
              {codes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <a
              className="btn"
              download="district-lookup-recovery-codes.txt"
              href={
                'data:text/plain;charset=utf-8,' +
                encodeURIComponent(
                  'District Lookup recovery codes\n\n' + codes.join('\n'),
                )
              }
            >
              <Download size={16} />
              Download codes
            </a>
            <a
              className="btn primary"
              href="/admin"
              style={{ display: 'flex', marginTop: 14 }}
            >
              Continue to administration <ArrowRight size={16} />
            </a>
          </>
        ) : (
          <>
            <div className="row small muted" style={{ marginBottom: 12 }}>
              <ShieldCheck size={16} />
              Agency administration
            </div>
            <h1>{titles[mode]}</h1>
            <p className="muted small">
              {mode === 'login'
                ? 'Sign in to keep your council information up to date.'
                : mode === 'setup'
                  ? 'Create your administrator account, then connect an authenticator app.'
                  : mode === 'enroll'
                    ? 'Scan this code with your authenticator app, then enter the six-digit code.'
                    : 'Enter the six-digit code from your authenticator app.'}
            </p>
            <form onSubmit={submit} className="stack">
              {error && (
                <div className="notice error" role="alert">
                  {error}
                </div>
              )}
              {mode === 'setup' && (
                <>
                  <label className="field">
                    Setup code
                    <input
                      required
                      value={setupToken}
                      onChange={(e) => setSetupToken(e.target.value)}
                      autoComplete="off"
                      type="password"
                    />
                    <small>Provided by RP Data during setup.</small>
                  </label>
                  <label className="field">
                    Your name
                    <input
                      name="name"
                      required
                      maxLength={100}
                      autoComplete="name"
                    />
                  </label>
                </>
              )}
              {(mode === 'login' || mode === 'setup') && (
                <>
                  <label className="field">
                    Email address
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="username"
                    />
                  </label>
                  <label className="field">
                    Password
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete={
                        mode === 'setup' ? 'new-password' : 'current-password'
                      }
                    />
                    {mode === 'setup' && (
                      <small>Use at least 12 characters.</small>
                    )}
                  </label>
                  {mode === 'setup' && (
                    <label className="field">
                      Confirm password
                      <input
                        name="confirm"
                        type="password"
                        required
                        minLength={12}
                        autoComplete="new-password"
                      />
                    </label>
                  )}
                </>
              )}
              {mode === 'enroll' && (
                <>
                  {qr ? (
                    <img
                      src={qr}
                      alt="Authenticator setup QR code"
                      className="auth-qr"
                    />
                  ) : (
                    <p className="small muted">Preparing your authenticator…</p>
                  )}
                  <details className="small">
                    <summary>Enter the key manually</summary>
                    <code style={{ overflowWrap: 'anywhere' }}>{secret}</code>
                  </details>
                </>
              )}
              {(mode === 'verify' || mode === 'enroll') && (
                <>
                  {recovery ? (
                    <label className="field">
                      Recovery code
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        autoComplete="off"
                        required
                      />
                    </label>
                  ) : (
                    <div className="field">
                      <label htmlFor="verification-code">
                        Verification code
                      </label>
                      <InputOTP
                        id="verification-code"
                        value={code}
                        onChange={setCode}
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]*"
                        required
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }, (_, i) => (
                            <InputOTPSlot
                              key={i}
                              index={i}
                              className="w-12 h-12 text-lg"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  )}
                  {mode === 'verify' && (
                    <button
                      type="button"
                      className="example-link"
                      onClick={() => {
                        setRecovery(!recovery);
                        setCode('');
                      }}
                    >
                      {recovery
                        ? 'Use an authenticator code'
                        : 'Use a recovery code'}
                    </button>
                  )}
                </>
              )}
              <button
                className="btn primary"
                type="submit"
                disabled={busy || (mode === 'enroll' && !qr)}
              >
                {busy
                  ? 'Please wait…'
                  : mode === 'login'
                    ? 'Sign in'
                    : mode === 'setup'
                      ? 'Continue to security setup'
                      : 'Verify and continue'}
                <ArrowRight size={16} />
              </button>
              {mode === 'login' && setupRequired && (
                <a
                  href="/admin/setup"
                  className="small"
                  style={{ textAlign: 'center' }}
                >
                  First time here? Set up the administrator
                </a>
              )}
              <a
                href="/martinez/classic"
                className="row small muted"
                style={{ textDecoration: 'none', justifyContent: 'center' }}
              >
                <ArrowLeft size={14} />
                Return to the lookup
              </a>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

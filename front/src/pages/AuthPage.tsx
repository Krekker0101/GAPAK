import React, { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../domains/auth/AuthContext';

const AuthPage: React.FC = () => {
  const { state, user, error, login, register, anonymousRegister, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isRegister = location.pathname === '/register';

  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (user) return <Navigate to="/posts" replace />;

  const busy = state === 'AUTHENTICATING' || state === 'REFRESHING';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    clearError();
    setSubmitError(null);
    try {
      if (isRegister) {
        await register({
          password,
          username: username.trim(),
          displayName: displayName.trim(),
          preferAnonymous: true,
        });
      } else {
        await login(loginValue.trim(), password);
      }
      navigate('/posts', { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  const anonymous = async () => {
    clearError();
    setSubmitError(null);
    try {
      // Anonymous accounts still require a server-valid username/password in the
      // current backend contract. Generate them locally so the guest action never
      // sends an empty JSON body (which previously produced request.invalid_json).
      const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replaceAll('-', '')
        : `${Date.now()}${Math.random().toString(36).slice(2)}`;
      const generatedUsername = `guest${random.slice(0, 20)}`;
      const generatedPassword = `${random}${random.slice(0, 12)}!A1`;
      await anonymousRegister({
        email: '',
        password: generatedPassword,
        username: generatedUsername,
        displayName: 'GAPAK Guest',
      });
      navigate('/posts', { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Anonymous registration failed');
    }
  };

  const message = submitError || error?.message;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-8">
          <p className="text-sm font-semibold tracking-[0.25em] text-slate-400">GAPAK</p>
          <h1 className="mt-2 text-3xl font-semibold">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {isRegister ? 'Create a real GAPAK session using the production authentication API.' : 'Sign in to your GAPAK account.'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {isRegister && (
            <>
              <label className="block text-sm text-slate-600">
                Username
                <input required minLength={3} maxLength={32} pattern="[A-Za-z0-9]+" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-white/30" autoComplete="username" />
              </label>
              <label className="block text-sm text-slate-600">
                Display name
                <input required minLength={2} maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-white/30" />
              </label>
            </>
          )}

          {!isRegister && (
            <label className="block text-sm text-slate-600">
              Email or username
              <input required value={loginValue} onChange={(e) => setLoginValue(e.target.value)} type="text" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-white/30" autoComplete="username" />
            </label>
          )}
          {isRegister && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">GAPAK registration is privacy-first: no email address is required.</p>
          )}

          <label className="block text-sm text-slate-600">
            Password
            <input required minLength={12} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-white/30" autoComplete={isRegister ? 'new-password' : 'current-password'} />
          </label>

          {message && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>}

          <button disabled={busy} type="submit" className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? 'Connecting…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button type="button" onClick={() => void anonymous()} disabled={busy} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
          Continue anonymously
        </button>

        <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
          <button type="button" onClick={() => navigate(isRegister ? '/login' : '/register')} className="hover:text-slate-950">
            {isRegister ? 'Already have an account?' : 'Create an account'}
          </button>
          <button type="button" onClick={() => navigate('/')} className="hover:text-slate-950">Home</button>
        </div>
      </div>
    </main>
  );
};

export const LoginPage = () => <AuthPage />;
export const RegisterPage = () => <AuthPage />;

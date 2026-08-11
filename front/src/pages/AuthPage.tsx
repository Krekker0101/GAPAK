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
        await register({ email: loginValue.trim(), password, username: username.trim(), displayName: displayName.trim() });
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
      await anonymousRegister();
      navigate('/posts', { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Anonymous registration failed');
    }
  };

  const message = submitError || error?.message;

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-8">
          <p className="text-sm font-semibold tracking-[0.25em] text-white/50">GAPAK</p>
          <h1 className="mt-2 text-3xl font-semibold">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-2 text-sm text-white/60">
            {isRegister ? 'Create a real GAPAK session using the production authentication API.' : 'Sign in to your GAPAK account.'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {isRegister && (
            <>
              <label className="block text-sm text-white/70">
                Username
                <input required minLength={3} maxLength={32} pattern="[A-Za-z0-9]+" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-white/30" autoComplete="username" />
              </label>
              <label className="block text-sm text-white/70">
                Display name
                <input required minLength={2} maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-white/30" />
              </label>
            </>
          )}

          <label className="block text-sm text-white/70">
            {isRegister ? 'Email' : 'Email or username'}
            <input required value={loginValue} onChange={(e) => setLoginValue(e.target.value)} type={isRegister ? 'email' : 'text'} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-white/30" autoComplete={isRegister ? 'email' : 'username'} />
          </label>

          <label className="block text-sm text-white/70">
            Password
            <input required minLength={12} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-white/30" autoComplete={isRegister ? 'new-password' : 'current-password'} />
          </label>

          {message && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{message}</div>}

          <button disabled={busy} type="submit" className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? 'Connecting…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button type="button" onClick={() => void anonymous()} disabled={busy} className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5 disabled:opacity-50">
          Continue anonymously
        </button>

        <div className="mt-6 flex items-center justify-between text-sm text-white/60">
          <button type="button" onClick={() => navigate(isRegister ? '/login' : '/register')} className="hover:text-white">
            {isRegister ? 'Already have an account?' : 'Create an account'}
          </button>
          <button type="button" onClick={() => navigate('/')} className="hover:text-white">Home</button>
        </div>
      </div>
    </main>
  );
};

export const LoginPage = () => <AuthPage />;
export const RegisterPage = () => <AuthPage />;

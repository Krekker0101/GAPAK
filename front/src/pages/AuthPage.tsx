import React, { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Lock,
  User,
  AtSign,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  UserRound,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../domains/auth/AuthContext';
import { Button, Input, SegmentedControl } from '../shared/design-system/primitives';
import { EscapingButton } from '../shared/ux/EscapingButton';

const AuthPage: React.FC = () => {
  const { state, user, error, login, register, anonymousRegister, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isRegister = location.pathname === '/register';

  const [loginValue, setLoginValue] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (user) return <Navigate to="/posts" replace />;

  const busy = state === 'AUTHENTICATING' || state === 'REFRESHING';

  // Mirrors the required fields/validation each mode actually submits, so the
  // "escaping" button (and its disabled state) only ever reacts to what's
  // truly missing — not to fields the current mode doesn't use.
  const isPasswordValid = password.length >= 12;
  const doPasswordsMatch = !isRegister || (confirmPassword.length > 0 && password === confirmPassword);
  const isFormValid = isRegister
    ? email.trim().length > 0 &&
      username.trim().length >= 3 &&
      displayName.trim().length >= 2 &&
      isPasswordValid &&
      doPasswordsMatch
    : loginValue.trim().length > 0 && isPasswordValid;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    clearError();
    setSubmitError(null);
    try {
      if (isRegister && password !== confirmPassword) {
        setSubmitError('Пароли не совпадают');
        return;
      }
      if (isRegister) {
        await register({
          email: email.trim(),
          password,
          username: username.trim(),
          displayName: displayName.trim(),
        });
      } else {
        await login({ login: loginValue.trim(), password, ...(totpCode.trim() ? { totpCode: totpCode.trim() } : {}) });
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
      if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
        throw new Error('Secure random generation is unavailable in this browser.');
      }
      const randomBytes = crypto.getRandomValues(new Uint8Array(24));
      const random = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      const generatedUsername = `guest${random.slice(0, 20)}`;
      const generatedPassword = `${random}${random.slice(0, 12)}!A1`;
      await anonymousRegister({
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
    <main className="relative flex min-h-screen bg-app app-shell-surface text-primary">
      {/* Brand panel: no fabricated users, counters, posts, or media. */}
      <div className="relative hidden w-[46%] max-w-2xl overflow-hidden border-r border-subtle lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 20% 0%, rgb(99 102 241 / .16), transparent 42rem), radial-gradient(circle at 90% 100%, rgb(168 85 247 / .14), transparent 38rem)',
          }}
        />
        <div className="relative z-10 flex h-full flex-col justify-center gap-6 px-12">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-indigo-600 text-white shadow-token-md">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-primary">GAPAK</span>
          </div>
          <h2 className="max-w-md text-4xl font-semibold leading-tight text-primary">
            Лента, где происходит всё интересное
          </h2>
          <p className="max-w-md text-base leading-relaxed text-secondary">
            После входа профиль, публикации, истории, сообщения и настройки загружаются из GAPAK API.
          </p>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* Mobile-only brand mark */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-indigo-600 text-white shadow-token-md">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-primary">GAPAK</span>
          </div>

          <div className="rounded-[var(--radius-3xl)] border border-subtle bg-surface p-7 shadow-token-lg sm:p-9">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-primary">
                  {isRegister ? 'Создать аккаунт' : 'С возвращением'}
                </h1>
                <p className="mt-1 text-sm text-secondary">
                  {isRegister ? 'Пара шагов — и вы в ленте' : 'Войдите, чтобы продолжить'}
                </p>
              </div>
            </div>

            <SegmentedControl
              value={isRegister ? 'register' : 'login'}
              onChange={(val) => navigate(val === 'register' ? '/register' : '/login')}
              options={[
                { label: 'Вход', value: 'login' },
                { label: 'Регистрация', value: 'register' },
              ]}
            />

            <AnimatePresence mode="wait">
              <motion.form
                key={isRegister ? 'register' : 'login'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                onSubmit={submit}
                className="mt-6 space-y-4"
              >
                {isRegister && (
                  <>
                    <Input
                      label="E-mail"
                      required
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      leftIcon={<Mail className="h-4 w-4" />}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <Input
                      label="Имя пользователя"
                      required
                      minLength={3}
                      maxLength={32}
                      pattern="[A-Za-z0-9]+"
                      autoComplete="username"
                      placeholder="username"
                      leftIcon={<AtSign className="h-4 w-4" />}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                    <Input
                      label="Отображаемое имя"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Как вас видят другие"
                      leftIcon={<User className="h-4 w-4" />}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </>
                )}

                {!isRegister && (
                  <Input
                    label="E-mail или имя пользователя"
                    required
                    autoComplete="username"
                    placeholder="you@example.com"
                    leftIcon={<Mail className="h-4 w-4" />}
                    value={loginValue}
                    onChange={(e) => setLoginValue(e.target.value)}
                  />
                )}

                <Input
                  label="Пароль"
                  required
                  minLength={12}
                  maxLength={128}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder="Минимум 12 символов"
                  leftIcon={<Lock className="h-4 w-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="pointer-events-auto text-tertiary transition hover:text-secondary"
                      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                {isRegister && (
                  <Input
                    label="Подтверждение пароля"
                    required
                    minLength={12}
                    maxLength={128}
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Повторите пароль"
                    leftIcon={<Lock className="h-4 w-4" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="pointer-events-auto text-tertiary transition hover:text-secondary"
                        aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                )}

                {isRegister && confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="-mt-2 text-xs font-medium text-rose-500">Пароли не совпадают</p>
                )}

                {!isRegister && (
                  <Input
                    label="Код аутентификатора (опционально)"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={12}
                    placeholder="6-значный код"
                    leftIcon={<ShieldCheck className="h-4 w-4" />}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  />
                )}

                {message && (
                  <div role="alert" className="rounded-[var(--radius-lg)] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
                    {message}
                  </div>
                )}

                <EscapingButton evade={!busy && !isFormValid}>
                  <Button
                    type="submit"
                    isLoading={busy}
                    disabled={busy || !isFormValid}
                    fullWidth
                    size="lg"
                    rightIcon={!busy ? <ArrowRight className="h-4 w-4" /> : undefined}
                  >
                    {busy ? 'Подключение…' : isRegister ? 'Создать аккаунт' : 'Войти'}
                  </Button>
                </EscapingButton>
              </motion.form>
            </AnimatePresence>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
              <span className="text-xs font-medium text-muted">или</span>
              <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
            </div>

            <Button
              type="button"
              variant="outline"
              fullWidth
              size="lg"
              leftIcon={<UserRound className="h-4 w-4" />}
              onClick={() => void anonymous()}
              disabled={busy}
            >
              Продолжить анонимно
            </Button>

            <div className="mt-7 flex items-center justify-between text-sm">
              <button type="button" onClick={() => navigate(isRegister ? '/login' : '/register')} className="font-medium text-indigo-500 hover:text-indigo-400">
                {isRegister ? 'Уже есть аккаунт?' : 'Создать аккаунт'}
              </button>
              <button type="button" onClick={() => navigate('/')} className="text-muted hover:text-secondary">
                На главную
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export const LoginPage = () => <AuthPage />;
export const RegisterPage = () => <AuthPage />;

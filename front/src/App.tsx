import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './features/auth/store/auth-store';
import { I18nProvider } from './shared/i18n/provider';
import { defaultLocale, getLocaleFromPath, localizePath } from './shared/i18n/config';
import { AppSidebar } from './components/layout/app-sidebar';
import { AppTopbar } from './components/layout/app-topbar';
import { AppMobileNav } from './components/layout/app-sidebar';

// Lazy load pages for better performance
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const Verify2FAPage = React.lazy(() => import('./pages/Verify2FAPage'));
const RecoverAccessPage = React.lazy(() => import('./pages/RecoverAccessPage'));
const FeedPage = React.lazy(() => import('./pages/FeedPage'));
const ChatsPage = React.lazy(() => import('./pages/ChatsPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const RoomsPage = React.lazy(() => import('./pages/RoomsPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const AdminBuilderPage = React.lazy(() => import('./pages/AdminBuilderPage'));
const ForbiddenPage = React.lazy(() => import('./pages/ForbiddenPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));
const ServerErrorPage = React.lazy(() => import('./pages/ServerErrorPage'));

// Protected route wrapper
function getLocalizedPath(path: string, currentPath: string) {
  const localeFromPath = getLocaleFromPath(currentPath);
  return localeFromPath ? localizePath(path, localeFromPath) : path;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to={getLocalizedPath('/login', location.pathname)} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// Auth route wrapper (redirect if already logged in)
function AuthRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (user) {
    const nextPath = (location.state as { from?: string })?.from;
    return <Navigate to={nextPath ?? getLocalizedPath('/feed', location.pathname)} replace />;
  }

  return <>{children}</>;
}

// Layout wrapper
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black">
      <div className="flex gap-4 p-4">
        <AppSidebar />
        <div className="flex-1 flex flex-col gap-4">
          <AppTopbar />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
      <AppMobileNav />
    </div>
  );
}

// Auth layout (without sidebar)
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {children}
    </div>
  );
}

function App() {
  return (
    <I18nProvider initialLocale={defaultLocale}>
      <div className="page-shell">
        <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Navigate to={`/${defaultLocale}/feed`} replace />} />

            <Route path="/:locale">
              <Route index element={<Navigate to="feed" replace />} />

              {/* Auth routes */}
              <Route
                path="login"
                element={
                  <AuthRoute>
                    <AuthLayout>
                      <LoginPage />
                    </AuthLayout>
                  </AuthRoute>
                }
              />
              <Route
                path="register"
                element={
                  <AuthRoute>
                    <AuthLayout>
                      <RegisterPage />
                    </AuthLayout>
                  </AuthRoute>
                }
              />
              <Route
                path="verify-2fa"
                element={
                  <AuthRoute>
                    <AuthLayout>
                      <Verify2FAPage />
                    </AuthLayout>
                  </AuthRoute>
                }
              />
              <Route
                path="recover-access"
                element={
                  <AuthRoute>
                    <AuthLayout>
                      <RecoverAccessPage />
                    </AuthLayout>
                  </AuthRoute>
                }
              />

              {/* Protected routes */}
              <Route
                path="feed"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <FeedPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="chats"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ChatsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="chats/:chatId"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ChatsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="profile"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProfilePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="profile/edit"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProfilePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="rooms"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <RoomsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="rooms/:roomId"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <RoomsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings/privacy"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SettingsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings/security"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SettingsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings/sessions"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SettingsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/builder"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AdminBuilderPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Error pages */}
              <Route path="forbidden" element={<ForbiddenPage />} />
              <Route path="server-error" element={<ServerErrorPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* Non-localized fallback routes */}
            <Route
              path="/login"
              element={
                <AuthRoute>
                  <AuthLayout>
                    <LoginPage />
                  </AuthLayout>
                </AuthRoute>
              }
            />
            <Route
              path="/register"
              element={
                <AuthRoute>
                  <AuthLayout>
                    <RegisterPage />
                  </AuthLayout>
                </AuthRoute>
              }
            />
            <Route
              path="/verify-2fa"
              element={
                <AuthRoute>
                  <AuthLayout>
                    <Verify2FAPage />
                  </AuthLayout>
                </AuthRoute>
              }
            />
            <Route
              path="/recover-access"
              element={
                <AuthRoute>
                  <AuthLayout>
                    <RecoverAccessPage />
                  </AuthLayout>
                </AuthRoute>
              }
            />

            <Route
              path="/feed"
              element={
                <ProtectedRoute>
                  <Layout>
                    <FeedPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chats"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ChatsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chats/:chatId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ChatsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProfilePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProfilePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rooms"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RoomsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rooms/:roomId"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RoomsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/privacy"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SettingsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/security"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SettingsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/sessions"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SettingsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/builder"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AdminBuilderPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route path="/forbidden" element={<ForbiddenPage />} />
            <Route path="/server-error" element={<ServerErrorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}

export default App;

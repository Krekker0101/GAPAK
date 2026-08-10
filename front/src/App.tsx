import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './shared/design-system/ThemeContext';
import { AuthProvider } from './domains/auth/AuthContext';
import { ToastProvider } from './shared/ux/ToastContext';
import { ModalProvider } from './shared/ux/ModalContext';
import { ErrorBoundary } from './shared/ux/ErrorBoundary';
import { QueryProvider } from './app/query/QueryProvider';
import { AppRouter } from './app/router/AppRouter';
import { RealtimeProvider } from './shared/realtime/RealtimeProvider';

export default function App() {
  return <ErrorBoundary><ThemeProvider><BrowserRouter><QueryProvider><AuthProvider><RealtimeProvider><ToastProvider><ModalProvider><AppRouter /></ModalProvider></ToastProvider></RealtimeProvider></AuthProvider></QueryProvider></BrowserRouter></ThemeProvider></ErrorBoundary>;
}

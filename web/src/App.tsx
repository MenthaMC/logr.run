import React, { lazy, Suspense, useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { useI18n } from './i18n';

const Home = lazy(() => import('./pages/Home'));
const LogViewer = lazy(() => import('./components/LogViewer'));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

const getPageFromPath = (path) => {
    if (path.startsWith('/view/')) return 'view';
    if (path === '/api') return 'api';
    if (path === '/login') return 'login';
    if (path === '/dashboard') return 'dashboard';
    return 'home';
};

const getLogIdFromPath = (path) => {
    if (!path.startsWith('/view/')) return null;
    const id = path.split('/view/')[1];
    return id || null;
};

export default function App() {
    const [page, setPage] = useState(() => getPageFromPath(window.location.pathname));
    const [logId, setLogId] = useState(() => getLogIdFromPath(window.location.pathname));
    const [initialContent, setInitialContent] = useState("");
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [animateDashboardEntry, setAnimateDashboardEntry] = useState(false);

    useEffect(() => {
        const syncFromPath = (path) => {
            const nextPage = getPageFromPath(path);
            setPage(nextPage);
            if (nextPage === 'view') {
                setLogId(getLogIdFromPath(path));
                return;
            }
            setLogId(null);
        };

        syncFromPath(window.location.pathname);

        const handlePopState = () => syncFromPath(window.location.pathname);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        const warmup = () => {
            const preloaders = [
                () => import('./pages/Home'),
                () => import('./components/LogViewer'),
                () => import('./pages/ApiDocs'),
                () => import('./pages/Login'),
                () => import('./pages/Dashboard')
            ];
            preloaders.forEach((load) => {
                void load().catch(() => {});
            });
        };

        if ('requestIdleCallback' in window) {
            const idleId = window.requestIdleCallback(warmup, { timeout: 2000 });
            return () => window.cancelIdleCallback(idleId);
        }

        const timer = window.setTimeout(warmup, 1200);
        return () => window.clearTimeout(timer);
    }, []);

    const handleLogin = (t) => {
        localStorage.setItem('token', t);
        setToken(t);
        setAnimateDashboardEntry(true);
        handleNav('dashboard', true);
    }

    const handleLogout = () => {
        localStorage.removeItem('token');
        setToken(null);
        handleNav('home', true);
    }

    const handleAuthError = () => {
        localStorage.removeItem('token');
        setToken(null);
        handleNav('login', true);
    }

    const handleNav = (target, replace = false) => {
        setPage(target);
        if (target !== 'dashboard') setAnimateDashboardEntry(false);
        if (target === 'view') return;
        const pathMap = {
            home: '/',
            api: '/api',
            login: '/login',
            dashboard: '/dashboard'
        };
        const nextPath = pathMap[target] || '/';
        if (replace) {
            window.history.replaceState({}, '', nextPath);
            return;
        }
        if (window.location.pathname !== nextPath) {
            window.history.pushState({}, '', nextPath);
        }
    }

    useEffect(() => {
        if (page !== 'dashboard' || !animateDashboardEntry) return;
        const timer = window.setTimeout(() => setAnimateDashboardEntry(false), 900);
        return () => window.clearTimeout(timer);
    }, [page, animateDashboardEntry]);

    const handleViewSuccess = (id, content) => {
        setLogId(id);
        setInitialContent(content);
        setPage('view');
        window.history.pushState({}, '', `/view/${id}`);
    }

    const handleDashboardView = (id) => {
        setLogId(id);
        setInitialContent("");
        setPage('view');
        window.history.pushState({}, '', `/view/${id}`);
    }

    const renderPage = () => {
        if (page === 'view') {
            return <LogViewer id={logId} initialContent={initialContent} onBack={() => handleNav('home')} token={token} />;
        }

        if (page === 'home') {
            return <div className="h-full overflow-y-auto custom-scrollbar"><Home onSuccess={(id, content) => handleViewSuccess(id, content)} onNav={handleNav} token={token} /></div>;
        }

        if (page === 'api') {
            return <div className="h-full overflow-y-auto custom-scrollbar"><ApiDocs /></div>;
        }

        if (page === 'login') {
            return <Login onLogin={handleLogin} />;
        }

        if (page === 'dashboard') {
            return (
                <div className="h-full overflow-y-auto custom-scrollbar">
                    <Dashboard
                        token={token}
                        onView={handleDashboardView}
                        onAuthError={handleAuthError}
                        animateOnEntry={animateDashboardEntry}
                    />
                </div>
            );
        }

        return null;
    };

    return (
        <ToastProvider>
            <ConfirmProvider>
                <div className="h-[100dvh] w-full flex flex-col font-sans bg-[#0a0b0d] text-zinc-200 overflow-hidden selection:bg-emerald-500/30">
                    <Navbar onNav={handleNav} currentPage={page} token={token} onLogout={handleLogout} />

                    <main className="flex-1 relative overflow-hidden flex flex-col">
                        <ErrorBoundary>
                            <Suspense fallback={<PageLoading />}>
                                {renderPage()}
                            </Suspense>
                        </ErrorBoundary>
                    </main>
                </div>
            </ConfirmProvider>
        </ToastProvider>
    );
}

function PageLoading() {
    const { t } = useI18n();

    return (
        <div className="h-full w-full flex items-center justify-center">
            <div className="text-xs text-zinc-500 font-mono tracking-wider">{t('common.loading')}</div>
        </div>
    );
}

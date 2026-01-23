import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LogViewer from './components/LogViewer';
import Home from './pages/Home';
import ApiDocs from './pages/ApiDocs';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/ConfirmDialog';

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

    const handleLogin = (t) => {
        localStorage.setItem('token', t);
        setToken(t);
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

    return (
        <ToastProvider>
            <ConfirmProvider>
                <div className="h-[100dvh] w-full flex flex-col font-sans bg-[#0b0b12] text-zinc-200 overflow-hidden selection:bg-emerald-500/30">
                    <Navbar onNav={handleNav} currentPage={page} token={token} onLogout={handleLogout} />

                    <main className="flex-1 relative overflow-hidden flex flex-col">
                        <ErrorBoundary>
                            {page === 'view' ? (
                                <LogViewer id={logId} initialContent={initialContent} onBack={() => handleNav('home')} token={token} />
                            ) : (
                                <>
                                    {page === 'home' && <div className="h-full overflow-y-auto custom-scrollbar"><Home onSuccess={(id, content) => handleViewSuccess(id, content)} onNav={handleNav} token={token} /></div>}
                                    {page === 'api' && <div className="h-full overflow-y-auto custom-scrollbar"><ApiDocs /></div>}
                                    {page === 'login' && <Login onLogin={handleLogin} />}
                                    {page === 'dashboard' && (
                                        <div className="h-full overflow-y-auto custom-scrollbar">
                                            <Dashboard token={token} onView={handleDashboardView} onAuthError={handleAuthError} />
                                        </div>
                                    )}
                                </>
                            )}
                        </ErrorBoundary>
                    </main>
                </div>
            </ConfirmProvider>
        </ToastProvider>
    );
}

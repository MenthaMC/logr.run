import React, { useState } from 'react';
import { Button } from '@/lib/ui';
import {
  Server, User, LayoutDashboard, LogOut,
  Github, Menu, X, FileText
} from 'lucide-react';
import { t } from '../lib/text';

export default function Navbar({ onNav, currentPage, token, onLogout }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="glass sticky top-0 z-50 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center cursor-pointer group" onClick={() => onNav('home')}>
            <span className="font-mono text-xl font-bold text-white tracking-tight group-hover:opacity-90 transition">
              logr<span className="text-emerald-500">.run</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-5">
            <a
              href="https://github.com/MenthaMC/logr.run"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 hover:text-white transition flex items-center gap-2 text-sm font-medium"
            >
              <Github size={18} />
              <span className="hidden lg:inline">GitHub</span>
            </a>

            <Button
              variant="light"
              onPress={() => onNav('api')}
              className={`h-auto min-w-0 p-0 flex items-center gap-2 text-sm font-medium transition ${currentPage === 'api' ? 'text-emerald-400' : 'text-zinc-400 data-[hover=true]:text-white'}`}
            >
              <FileText size={18} /> {t('navbar.apiDocs')}
            </Button>

            <div className="w-px h-4 bg-white/10 mx-2"></div>

            {token ? (
              <>
                <Button
                  variant="light"
                  onPress={() => onNav('dashboard')}
                  className={`h-auto min-w-0 p-0 flex items-center gap-2 text-sm font-medium transition ${currentPage === 'dashboard' ? 'text-white' : 'text-zinc-400 data-[hover=true]:text-white'}`}
                >
                  <LayoutDashboard size={18} /> {t('navbar.dashboard')}
                </Button>
                <Button
                  isIconOnly
                  variant="light"
                  onPress={onLogout}
                  className="p-2 text-zinc-400 data-[hover=true]:text-red-300 data-[hover=true]:bg-red-500/10 rounded-lg transition border border-transparent data-[hover=true]:border-red-500/20"
                  title={t('navbar.logout')}
                >
                  <LogOut size={18} />
                </Button>
              </>
            ) : (
              <Button
                onPress={() => onNav('login')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border border-white/15 bg-white/5 text-zinc-100 data-[hover=true]:bg-white/10"
              >
                <User size={16} /> {t('navbar.login')}
              </Button>
            )}
          </div>

          <Button
            isIconOnly
            variant="light"
            className="sm:hidden p-2 text-zinc-400 data-[hover=true]:text-white transition"
            onPress={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </Button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="sm:hidden glass border-t border-white/10 animate-slide-up absolute top-full left-0 w-full h-[calc(100dvh-4rem)] z-40 overflow-y-auto">
          <div className="px-4 py-4 space-y-4">
            <a
              href="https://github.com/MenthaMC/logr.run"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 text-zinc-400 hover:text-white px-4 py-4 rounded-xl hover:bg-white/5 transition touch-manipulation"
            >
              <Github size={24} /> <span className="text-base font-medium">GitHub</span>
            </a>

            <Button
              variant="light"
              onPress={() => { onNav('api'); setIsMenuOpen(false); }}
              className={`flex items-center justify-start gap-3 w-full px-4 py-4 rounded-xl transition touch-manipulation ${currentPage === 'api' ? 'bg-white/10 text-white' : 'text-zinc-400 data-[hover=true]:text-white data-[hover=true]:bg-white/5'}`}
            >
              <Server size={24} /> <span className="text-base font-medium">{t('navbar.apiDocs')}</span>
            </Button>

            <div className="h-px bg-white/5 my-2"></div>

            {token ? (
              <>
                <Button
                  variant="light"
                  onPress={() => { onNav('dashboard'); setIsMenuOpen(false); }}
                  className={`flex items-center justify-start gap-3 w-full px-4 py-4 rounded-xl transition touch-manipulation ${currentPage === 'dashboard' ? 'bg-white/10 text-white' : 'text-zinc-400 data-[hover=true]:text-white data-[hover=true]:bg-white/5'}`}
                >
                  <LayoutDashboard size={24} /> <span className="text-base font-medium">{t('navbar.dashboard')}</span>
                </Button>
                <Button
                  variant="light"
                  onPress={() => { onLogout(); setIsMenuOpen(false); }}
                  className="flex items-center justify-start gap-3 w-full px-4 py-4 rounded-xl text-zinc-400 data-[hover=true]:text-red-400 data-[hover=true]:bg-red-500/10 transition touch-manipulation"
                >
                  <LogOut size={24} /> <span className="text-base font-medium">{t('navbar.logout')}</span>
                </Button>
              </>
            ) : (
              <Button
                onPress={() => { onNav('login'); setIsMenuOpen(false); }}
                className="flex items-center justify-center gap-2 w-full px-4 py-4 rounded-xl font-semibold border border-white/15 bg-white/5 text-zinc-100 data-[hover=true]:bg-white/10 transition touch-manipulation"
              >
                <User size={20} /> <span className="text-base">{t('navbar.loginRegister')}</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

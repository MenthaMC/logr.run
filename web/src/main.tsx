import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import '@fontsource/noto-sans-sc/chinese-simplified-400.css'
import '@fontsource/noto-sans-sc/chinese-simplified-500.css'
import '@fontsource/noto-sans-sc/chinese-simplified-700.css'
import './styles/tailwind.css'
import './styles/global.css'
import './styles/components.css'
import App from './App'
import { I18nProvider } from './i18n'

const preloadModuleByPath = (path) => {
  if (path.startsWith('/view/')) return import('./components/LogViewer')
  if (path === '/api') return import('./pages/ApiDocs')
  if (path === '/login') return import('./pages/Login')
  if (path === '/dashboard') return import('./pages/Dashboard')
  return import('./pages/Home')
}

void preloadModuleByPath(window.location.pathname).catch(() => {})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)

/// <reference types="vite/client" />

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

interface TurnstileApi {
  render(container: string | HTMLElement, options: TurnstileRenderOptions): string;
  reset(widgetId?: string | number): void;
  remove(widgetId: string | number): void;
}

interface Window {
  turnstile?: TurnstileApi;
}

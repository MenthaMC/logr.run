import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0b0d',
        surface: '#0e0e11',
        'surface-hover': '#18181b',
        border: '#27272a',
        primary: '#10b981',
        'primary-hover': '#059669',
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'Noto Sans SC', 'Fira Code', 'Cascadia Code', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', 'monospace'],
        mono: ['JetBrains Mono', 'Noto Sans SC', 'Fira Code', 'Cascadia Code', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: []
};

export default config;

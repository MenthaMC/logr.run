const MESSAGES = {
  common: {
    loading: 'Loading...',
  },
  navbar: {
    apiDocs: 'API Docs',
    dashboard: 'Dashboard',
    logout: 'Log out',
    login: 'Log in',
    loginRegister: 'Log in / Sign up',
  },
  dashboard: {
    refreshLogs: 'Refresh logs',
    allLogs: 'All logs',
    crash: 'Crash',
    events: 'Events',
    issues: 'Issues',
  },
  issues: {
    title: 'Issues',
    sortRecent: 'Recent',
    sortCount: 'Count',
    searchPlaceholder: 'Search title / signature...',
    loadFailed: 'Failed to load issues',
    loadDetailFailed: 'Failed to load issue details',
    copySuccess: 'Copied',
    copyFailed: 'Copy failed',
    level: 'Level',
    colTitle: 'Title',
    colCount: 'Count',
    colLastSeen: 'Last seen',
    loading: 'Loading...',
    empty: 'No issues',
    issueFallback: 'Issue',
    copySignature: 'Copy signature',
    detailLoading: 'Loading details...',
    noData: 'No data',
    timeline: 'Timeline',
    tags: 'Tags',
    events: 'Events',
    eventFallback: 'Event',
    open: 'Open',
    noEvents: 'No events',
  },
  login: {
    createAccount: 'Create Account',
    welcomeBack: 'Welcome Back',
    registerHint: 'Register a new account to continue.',
    loginHint: 'Sign in to open your dashboard.',
    username: 'Username',
    usernamePlaceholder: 'Enter username',
    password: 'Password',
    passwordPlaceholder: 'Enter password',
    confirmPassword: 'Confirm Password',
    confirmPasswordPlaceholder: 'Confirm password',
    show: 'Show',
    hide: 'Hide',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    loadingCaptcha: 'Loading captcha...',
    signIn: 'Sign In',
    switchToLogin: 'Already have an account? Sign in.',
    switchToRegister: 'No account yet? Register now.',
    registerSuccess: 'Registration successful. Please login.',
    errors: {
      missingFields: 'Please fill in all required fields.',
      invalidFields: 'Invalid username or password format.',
      usernameTooLong: 'Username is too long.',
      passwordTooLong: 'Password is too long.',
      userNotFound: 'User not found.',
      passwordsMismatch: 'Passwords do not match.',
      invalidCredentials: 'Invalid username or password.',
      usernameExists: 'Username already exists.',
      invalidCaptcha: 'Captcha validation failed. Please retry.',
      captchaRequired: 'Please complete the captcha.',
      captchaExpired: 'Captcha expired. Please retry.',
      weakPassword: 'Password must be 8+ chars and include letters and numbers.',
      registerFailed: 'Registration failed. Please try again.',
      loginFailed: 'Login failed. Please try again.',
      unknownAuth: 'Unknown authentication error.',
      turnstileNotConfigured: 'Turnstile site key is not configured.',
      loadCaptchaFailed: 'Failed to load captcha. Please retry.',
      confirmPasswordRequired: 'Please confirm your password.',
    },
  },
} as const;

function readMessage(obj: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      obj,
    );
}

export function t(key: string): string {
  const message = readMessage(MESSAGES, key);
  return typeof message === 'string' ? message : key;
}


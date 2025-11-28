export const ACCESS_TOKEN_KEY = 'accessToken';

// Support both import.meta.env (Vite) dan process.env (Webpack)
const getEnv = (key, defaultValue) => {
  if (typeof import !== 'undefined' && import.meta?.env) {
    return import.meta.env[key] || defaultValue;
  }
  return process.env[key] || defaultValue;
};

export const BASE_URL = getEnv(
  'VITE_API_BASE_URL',
  'https://story-api.dicoding.dev/v1'
);

export const MAP_SERVICE_API_KEY = getEnv(
  'VITE_MAP_SERVICE_API_KEY',
  'x02r9WSjHseBBp4yxRmy'
);

export const VAPID_PUBLIC_KEY = getEnv(
  'VITE_VAPID_PUBLIC_KEY',
  'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk'
);

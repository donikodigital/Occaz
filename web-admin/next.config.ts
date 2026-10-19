// web-admin/next.config.ts
// [19/10/2026] v2 — En-têtes de sécurité sur toutes les pages (aucun n'existait) :
//  • Content-Security-Policy : le navigateur refuse tout script, cadre ou connexion venant d'ailleurs que ce site — une injection de script
//    (XSS) ne peut plus appeler un serveur de l'attaquant. Les appels à l'API passent par le relais same-origin /api/bff, donc connect-src
//    reste « 'self' » (+ l'hôte Sentry s'il est configuré). 'unsafe-inline' sur les scripts est exigé par le démarrage de Next.js sans
//    nonce ; il ne retire pas les autres protections (object-src, base-uri, frame-ancestors, connect-src).
//  • HSTS (https obligatoire), X-Frame-Options/frame-ancestors (aucun cadre : anti-clickjacking), nosniff, Referrer-Policy, Permissions-Policy
//    (aucun capteur), Cross-Origin-Opener-Policy.
import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

/** Origine d'ingestion Sentry à autoriser, si NEXT_PUBLIC_SENTRY_DSN est renseigné. */
function sentryOrigin(): string | null {
  try {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    return dsn ? new URL(dsn).origin : null;
  } catch {
    return null;
  }
}

function contentSecurityPolicy(): string {
  const sentry = sentryOrigin();
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // 'unsafe-eval' seulement en développement (rechargement à chaud de Next.js).
    'script-src': ["'self'", "'unsafe-inline'", ...(isProduction ? [] : ["'unsafe-eval'"])],
    'style-src': ["'self'", "'unsafe-inline'"],
    // Photos de profil, documents, couvertures d'articles : hébergés sur le stockage de fichiers (https) ou intégrés (data:, blob:).
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(sentry ? [sentry] : []), ...(isProduction ? [] : ['ws:', 'wss:'])],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    ...(isProduction ? { 'upgrade-insecure-requests': [] } : {}),
  };
  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(' ')}` : name))
    .join('; ');
}

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ne pas annoncer « X-Powered-By: Next.js » à qui regarde les en-têtes.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

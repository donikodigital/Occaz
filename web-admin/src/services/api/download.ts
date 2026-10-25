// web-admin/src/services/api/download.ts
// [25/10/2026] v1 — Téléchargement d'un fichier (PDF, Excel) servi par l'API : passe par le relais /api/bff comme tous les appels (cookies
// HttpOnly, aucun jeton en main), reçoit le fichier en entier puis le fait enregistrer par le navigateur sous le nom donné par le serveur.
import { ApiError } from './ApiError';

const BFF_BASE = '/api/bff';

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(`${BFF_BASE}/${path.replace(/^\//, '')}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
}

/** Nom du fichier annoncé par le serveur (Content-Disposition), à défaut `fallback`. */
function filenameFrom(response: Response, fallback: string): string {
  const header = response.headers.get('content-disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  if (!match) return fallback;
  try {
    return decodeURIComponent(match[1]).replace(/[\\/]/g, '_');
  } catch {
    return match[1].replace(/[\\/]/g, '_');
  }
}

export async function downloadFile(path: string, options: { query?: Record<string, string | number | undefined>; fallbackName: string }): Promise<void> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError('Connexion impossible — vérifiez votre réseau.', 0);
  }

  if (!response.ok) {
    if (response.status === 401 && response.headers.get('x-session-expired') === '1') {
      throw new ApiError('Ta session a expiré : reconnecte-toi, puis réessaie.', 401);
    }
    const json = (await response.json().catch(() => null)) as { error?: { message?: string | string[] } } | null;
    const message = json?.error?.message;
    throw new ApiError(Array.isArray(message) ? message.join(' ') : (message ?? 'Le téléchargement a échoué.'), response.status);
  }

  const blob = await response.blob();
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filenameFrom(response, options.fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

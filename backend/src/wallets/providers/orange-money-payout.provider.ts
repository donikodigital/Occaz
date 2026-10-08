// backend/src/wallets/providers/orange-money-payout.provider.ts
//
// Adaptateur Orange Money (compte marchand → numéro Mobile Money) : TERRAIN PRÉPARÉ, EN ATTENTE DE LA DOCUMENTATION OFFICIELLE.
//
// ⚠️ Ce fichier a été écrit SANS la documentation de l'API marchand Orange Money. Tout ce qui en dépend est isolé, marqué
// « À CONFIRMER » et réglable par variables d'environnement :
//   - l'adresse du service, l'authentification, le chemin de l'appel de virement (aucun chemin par défaut : tant qu'ils ne sont pas
//     renseignés, l'adaptateur refuse de démarrer et le serveur reste sur la simulation / le virement à la main) ;
//   - la forme du corps envoyé (buildRequestBody) et la lecture de la réponse (interpretResponse).
// Le reste — délai maximal, jeton réutilisé, règles « résultat inconnu » et clé d'idempotence — est définitif et testé.
//
// Règles de sécurité de l'argent (contrat PayoutProvider) :
//   - PAID / FAILED seulement quand le prestataire est SÛR du résultat. FAILED = aucun argent n'est parti (erreur de validation).
//   - Tout le reste (réseau coupé, délai dépassé, erreur serveur 5xx, doublon 409, réponse incompréhensible) → on LÈVE une exception :
//     « résultat inconnu », le retrait reste « en cours » pour vérification dans le compte marchand, jamais remboursé tout seul.
//   - `reference` (identifiant du retrait) est envoyée comme clé d'idempotence : un même retrait ne peut pas partir deux fois.
//
// Variables d'environnement (à définir sur Render), avec PAYOUT_PROVIDER=orange_money :
//   ORANGE_MONEY_BASE_URL         adresse de base de l'API, sans « / » final
//   ORANGE_MONEY_CLIENT_ID        identifiant d'application
//   ORANGE_MONEY_CLIENT_SECRET    secret d'application
//   ORANGE_MONEY_MERCHANT_CODE    code / numéro du compte marchand qui paie
//   ORANGE_MONEY_TOKEN_PATH       chemin de l'appel qui délivre le jeton d'accès
//   ORANGE_MONEY_DISBURSE_PATH    chemin de l'appel de virement
//   ORANGE_MONEY_TIMEOUT_MS       délai maximal d'un appel (défaut 20000)
import { Injectable, Logger } from '@nestjs/common';
import { DisburseOutcome, DisburseParams, PayoutProvider } from './payout-provider.interface';

export interface OrangeMoneyConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  merchantCode: string;
  tokenPath: string;
  disbursePath: string;
  timeoutMs: number;
}

/** Lit la configuration ; renvoie la liste des variables manquantes si elle est incomplète. */
export function readOrangeMoneyConfig(env: NodeJS.ProcessEnv = process.env): { config?: OrangeMoneyConfig; missing: string[] } {
  const required = [
    'ORANGE_MONEY_BASE_URL',
    'ORANGE_MONEY_CLIENT_ID',
    'ORANGE_MONEY_CLIENT_SECRET',
    'ORANGE_MONEY_MERCHANT_CODE',
    'ORANGE_MONEY_TOKEN_PATH',
    'ORANGE_MONEY_DISBURSE_PATH',
  ];
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length > 0) return { missing };
  const timeout = Number(env.ORANGE_MONEY_TIMEOUT_MS);
  return {
    missing,
    config: {
      baseUrl: (env.ORANGE_MONEY_BASE_URL as string).trim().replace(/\/+$/, ''),
      clientId: (env.ORANGE_MONEY_CLIENT_ID as string).trim(),
      clientSecret: (env.ORANGE_MONEY_CLIENT_SECRET as string).trim(),
      merchantCode: (env.ORANGE_MONEY_MERCHANT_CODE as string).trim(),
      tokenPath: (env.ORANGE_MONEY_TOKEN_PATH as string).trim(),
      disbursePath: (env.ORANGE_MONEY_DISBURSE_PATH as string).trim(),
      timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 20_000,
    },
  };
}

/** Résultat « inconnu » : l'argent est peut-être parti. PayoutsService laisse alors le retrait « en cours ». */
export class UnknownDisbursementResult extends Error {}

// ─── À CONFIRMER avec la documentation ───────────────────────────────────────────────────────────────────────────────────────

/** Numéro tel que l'API l'attend. À CONFIRMER : avec ou sans « + », avec ou sans indicatif pays. Ici : chiffres seulement, indicatif compris. */
export function formatMsisdn(destination: string): string {
  return destination.replace(/\D/g, '');
}

/** Corps de l'appel de virement. À CONFIRMER : noms des champs, unité du montant, présence du code marchand. */
export function buildRequestBody(params: DisburseParams, merchantCode: string): Record<string, unknown> {
  return {
    reference: params.reference,
    merchantCode,
    amount: params.amount.toString(), // plus petite unité : le GNF et le XOF n'ont pas de centimes
    currency: params.currencyIsoCode,
    receiver: { msisdn: formatMsisdn(params.destination) },
  };
}

const PAID_STATUSES = new Set(['SUCCESS', 'SUCCESSFUL', 'SUCCEEDED', 'COMPLETED', 'PAID']);
const PENDING_STATUSES = new Set(['PENDING', 'PROCESSING', 'ACCEPTED', 'INITIATED', 'IN_PROGRESS']);
const FAILED_STATUSES = new Set(['FAILED', 'REJECTED', 'DECLINED', 'EXPIRED', 'CANCELLED']);

/**
 * Lit la réponse d'un appel réussi (HTTP 2xx). À CONFIRMER : noms des champs de statut, de référence et de message d'erreur.
 * Toute réponse qu'on ne reconnaît pas est « inconnue » (exception), jamais devinée.
 */
export function interpretResponse(body: unknown, reference: string): DisburseOutcome {
  const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const rawStatus = String(data.status ?? data.transactionStatus ?? '').trim().toUpperCase();
  const externalReference = String(data.transactionId ?? data.id ?? data.reference ?? reference);

  if (PAID_STATUSES.has(rawStatus)) return { status: 'PAID', externalReference };
  if (PENDING_STATUSES.has(rawStatus)) return { status: 'PROCESSING', externalReference };
  if (FAILED_STATUSES.has(rawStatus)) {
    return { status: 'FAILED', reason: String(data.message ?? data.reason ?? 'Virement refusé par Orange Money.'), externalReference };
  }
  throw new UnknownDisbursementResult(`Réponse Orange Money non reconnue (statut « ${rawStatus || 'absent'} ») pour le retrait ${reference}.`);
}

// ─── Mécanique (définitive) ──────────────────────────────────────────────────────────────────────────────────────────────────

type FetchLike = typeof fetch;

@Injectable()
export class OrangeMoneyPayoutProvider implements PayoutProvider {
  readonly isSimulated = false;
  private readonly logger = new Logger('OrangeMoneyPayoutProvider');
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: OrangeMoneyConfig,
    private readonly http: FetchLike = fetch,
  ) {}

  async disburse(params: DisburseParams): Promise<DisburseOutcome> {
    const response = await this.callDisburse(params, false);

    if (response.status >= 200 && response.status < 300) {
      return interpretResponse(await this.readJson(response), params.reference);
    }
    // Refus définitif de la demande : aucun argent n'est parti. 401/403 (identifiants), 408/429 (réessayable), 409 (doublon : le
    // virement existe peut-être déjà) et 5xx sont des cas « inconnu » — jamais un échec que l'on rembourserait.
    if (response.status >= 400 && response.status < 500 && ![401, 403, 408, 409, 429].includes(response.status)) {
      const body = (await this.readJson(response).catch(() => ({}))) as Record<string, unknown>;
      return { status: 'FAILED', reason: String(body.message ?? body.reason ?? `Refusé par Orange Money (HTTP ${response.status}).`) };
    }
    throw new UnknownDisbursementResult(`Orange Money a répondu HTTP ${response.status} pour le retrait ${params.reference} : résultat à vérifier.`);
  }

  /** Un appel de virement ; si le jeton est refusé (401), on en demande un neuf et on rejoue UNE fois (la clé d'idempotence protège). */
  private async callDisburse(params: DisburseParams, retried: boolean): Promise<Response> {
    const token = await this.getToken();
    const response = await this.request(this.config.disbursePath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': params.reference, // À CONFIRMER : nom de l'en-tête (la référence dans le corps joue le même rôle)
      },
      body: JSON.stringify(buildRequestBody(params, this.config.merchantCode)),
    });
    if (response.status === 401 && !retried) {
      this.token = null;
      return this.callDisburse(params, true);
    }
    return response;
  }

  /** Jeton d'accès, réutilisé jusqu'à une minute avant son expiration. À CONFIRMER : type d'authentification et champs de la réponse. */
  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;

    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const response = await this.request(this.config.tokenPath, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: 'grant_type=client_credentials',
    });
    if (!response.ok) {
      // Aucun virement n'a été tenté : on ne peut pas non plus conclure à un refus du retrait → résultat « inconnu » pour vérification.
      throw new UnknownDisbursementResult(`Orange Money : jeton d'accès refusé (HTTP ${response.status}). Vérifier ORANGE_MONEY_CLIENT_ID / SECRET.`);
    }
    const body = (await this.readJson(response)) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new UnknownDisbursementResult("Orange Money : réponse sans jeton d'accès.");
    this.token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 300) * 1000 };
    return body.access_token;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      return await this.http(`${this.config.baseUrl}${path}`, { ...init, signal: controller.signal });
    } catch (error) {
      // Réseau coupé ou délai dépassé : la requête est peut-être arrivée → résultat inconnu.
      this.logger.error(`Appel Orange Money sans réponse (${path}) : ${(error as Error).message}`);
      throw new UnknownDisbursementResult(`Orange Money injoignable ou trop lent : ${(error as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new UnknownDisbursementResult('Orange Money : réponse illisible.');
    }
  }
}
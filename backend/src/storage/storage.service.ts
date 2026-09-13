// backend/src/storage/storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Un seul point d'accès au stockage d'objets pour tout le backend.
 * Cloudflare R2 est 100% compatible avec l'API S3 (mêmes commandes,
 * juste un `endpoint` différent) — ce service fonctionne donc aussi
 * tel quel avec AWS S3, Backblaze B2, ou tout autre stockage
 * compatible S3, en ne changeant que les variables d'environnement.
 *
 * Flux d'upload (jamais de fichier qui transite par ce serveur NestJS,
 * le client envoie directement au stockage) :
 *   1. Le client demande une URL d'upload à un module propriétaire
 *      (ex: POST /driver-profiles/me/documents/upload-url)
 *   2. Ce service génère une clé unique + une URL PUT signée, valable
 *      quelques minutes
 *   3. Le client fait un PUT direct de son fichier vers cette URL
 *   4. Le client confirme via la route existante (ex: POST
 *      /driver-profiles/me/documents) avec la même storageKey — c'est
 *      seulement à cette étape que la ligne Document est créée, donc
 *      un upload jamais confirmé ne laisse aucune trace en base
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | undefined;
  private bucket: string | undefined;
  /** Durée de validité des URL signées — assez court pour limiter le risque si une URL fuite, assez long pour un envoi sur réseau mobile lent. */
  private readonly urlTtlSeconds = 5 * 60;

  /**
   * Initialisation différée plutôt qu'au constructeur : tant que R2
   * n'est pas configuré, le reste du backend démarre normalement — seul
   * un appel réel à l'upload/téléchargement échoue, avec un message
   * clair plutôt qu'un crash au démarrage de toute l'application.
   */
  private getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: requireEnv('STORAGE_ENDPOINT'),
        credentials: {
          accessKeyId: requireEnv('STORAGE_ACCESS_KEY_ID'),
          secretAccessKey: requireEnv('STORAGE_SECRET_ACCESS_KEY'),
        },
      });
    }
    return this.client;
  }

  private getBucket(): string {
    this.bucket ??= requireEnv('STORAGE_BUCKET');
    return this.bucket;
  }

  /**
   * Construit une clé d'objet organisée par type de propriétaire —
   * jamais le nom de fichier original du client (évite les collisions
   * et toute fuite d'information via le nom de fichier).
   */
  buildKey(ownerType: string, ownerId: string, extension: string): string {
    const safeExtension = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    return `${ownerType.toLowerCase()}/${ownerId}/${randomUUID()}.${safeExtension}`;
  }

  async createUploadUrl(key: string, contentType: string): Promise<{ uploadUrl: string; expiresInSeconds: number }> {
    const command = new PutObjectCommand({ Bucket: this.getBucket(), Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(this.getClient(), command, { expiresIn: this.urlTtlSeconds });
    return { uploadUrl, expiresInSeconds: this.urlTtlSeconds };
  }

  /**
   * URL de lecture signée et temporaire — jamais d'URL publique permanente
   * pour des pièces d'identité, même si le bucket lui-même le permettait.
   */
  async createDownloadUrl(key: string): Promise<string> {
    const publicBaseUrl = process.env.STORAGE_PUBLIC_BASE_URL;
    if (publicBaseUrl) {
      // Bucket avec domaine public déjà configuré (cas d'usage non sensible) : pas besoin de signer.
      return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }
    const command = new GetObjectCommand({ Bucket: this.getBucket(), Key: key });
    return getSignedUrl(this.getClient(), command, { expiresIn: this.urlTtlSeconds });
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.getClient().send(new DeleteObjectCommand({ Bucket: this.getBucket(), Key: key }));
    } catch (error) {
      // Ne bloque jamais l'appelant (ex: suppression d'un compte) si l'objet est déjà absent du stockage.
      this.logger.warn(`Échec de suppression de l'objet ${key} : ${(error as Error).message}`);
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement ${name} manquante — voir .env.example (section stockage R2/S3).`,
    );
  }
  return value;
}

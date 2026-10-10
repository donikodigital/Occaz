// backend/src/integrations/email/resend-email.provider.attachments.spec.ts
// Les pièces jointes (billet, étiquettes) partent en base64 vers Resend ; sans pièce jointe, le corps de la requête est inchangé.
import { ResendEmailProvider } from './resend-email.provider';

describe('ResendEmailProvider — pièces jointes', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'key';
    process.env.RESEND_FROM_EMAIL = 'billets@example.com';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  function mockFetch() {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as never;
    return fetchMock;
  }

  it('envoie le fichier en base64 avec son nom', async () => {
    const fetchMock = mockFetch();
    await new ResendEmailProvider().send('client@example.com', 'Votre billet', 'Bonjour', undefined, [
      { filename: 'billet.pdf', content: Buffer.from('%PDF-1.3 test'), contentType: 'application/pdf' },
    ]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.attachments).toEqual([{ filename: 'billet.pdf', content: Buffer.from('%PDF-1.3 test').toString('base64') }]);
    expect(body.to).toBe('client@example.com');
  });

  it('sans pièce jointe, aucune clé attachments dans la requête', async () => {
    const fetchMock = mockFetch();
    await new ResendEmailProvider().send('client@example.com', 'Sujet', 'Corps');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('attachments');
  });
});

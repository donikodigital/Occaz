// backend/src/common/filters/http-exception.filter.language.spec.ts
// Le message d'erreur part dans la langue de l'application ; le français est inchangé.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function run(exception: Error, headers: Record<string, string> = {}, user?: { language: string }, query?: Record<string, string>) {
  const json = jest.fn();
  const response = { status: jest.fn().mockReturnValue({ json }) };
  const request = { method: 'GET', url: '/x', headers, user, query };
  const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }) };
  new HttpExceptionFilter().catch(exception as never, host as never);
  return json.mock.calls[0][0].error.message;
}

describe('HttpExceptionFilter — langue', () => {
  it('français par défaut, anglais et portugais selon l\'en-tête', () => {
    const exception = new NotFoundException('Ce billet est introuvable.');
    expect(run(exception)).toBe('Ce billet est introuvable.');
    expect(run(exception, { 'x-app-language': 'en-GB' })).toBe('This ticket cannot be found.');
    expect(run(exception, { 'x-app-language': 'pt-PT' })).toBe('Este bilhete não foi encontrado.');
  });

  it('sans en-tête : langue du compte connecté ; avec ?lang= : celle du lien', () => {
    const exception = new NotFoundException('Ce billet est introuvable.');
    expect(run(exception, {}, { language: 'en-GB' })).toBe('This ticket cannot be found.');
    expect(run(exception, {}, { language: 'en-GB' }, { lang: 'pt' })).toBe('Este bilhete não foi encontrado.');
  });

  it('liste d\'erreurs de validation : chaque message est traduit, les inconnus restent tels quels', () => {
    const exception = new BadRequestException({ message: ['Adresse e-mail invalide.', 'phone must be a string'] });
    expect(run(exception, { 'x-app-language': 'en-GB' })).toEqual(['Invalid email address.', 'phone must be a string']);
  });
});

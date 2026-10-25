// backend/src/company-documents/company-document-rules.spec.ts
import { AccountType } from '@prisma/client';
import {
  canChangeCompanyDocument,
  canSeeCompanyDocument,
  cleanFileName,
  contentDispositionFor,
  opensInBrowser,
  parseDocumentDate,
  titleFromFileName,
  visibleDocumentsWhere,
} from './company-document-rules';

const admin = { id: 'admin', accountType: AccountType.SUPERADMIN };
const agent = { id: 'agent', accountType: AccountType.SUPPORT };
const other = { id: 'other', accountType: AccountType.SUPPORT };

describe('visibilité', () => {
  const open = { restricted: false, uploadedById: 'agent' };
  const secret = { restricted: true, uploadedById: 'agent' };

  it('un document ordinaire est vu de tous', () => {
    expect(canSeeCompanyDocument(other, open)).toBe(true);
  });

  it('un document réservé est vu du SuperAdmin et de la personne qui l’a déposé, pas des autres', () => {
    expect(canSeeCompanyDocument(admin, secret)).toBe(true);
    expect(canSeeCompanyDocument(agent, secret)).toBe(true);
    expect(canSeeCompanyDocument(other, secret)).toBe(false);
  });

  it('un document réservé dont le dépositaire a disparu n’est vu que du SuperAdmin', () => {
    const orphan = { restricted: true, uploadedById: null };
    expect(canSeeCompanyDocument(agent, orphan)).toBe(false);
    expect(canSeeCompanyDocument(admin, orphan)).toBe(true);
  });

  it('le filtre de liste suit la même règle', () => {
    expect(visibleDocumentsWhere(admin)).toEqual({});
    expect(visibleDocumentsWhere(agent)).toEqual({ OR: [{ restricted: false }, { uploadedById: 'agent' }] });
  });

  it('modifier ou supprimer : le SuperAdmin ou la personne qui a déposé le document', () => {
    expect(canChangeCompanyDocument(admin, open)).toBe(true);
    expect(canChangeCompanyDocument(agent, open)).toBe(true);
    expect(canChangeCompanyDocument(other, open)).toBe(false);
    expect(canChangeCompanyDocument(agent, { restricted: false, uploadedById: null })).toBe(false);
  });
});

describe('cleanFileName', () => {
  it('retire le chemin, les caractères de contrôle et les espaces en trop', () => {
    expect(cleanFileName('C:\\Users\\moi\\PV  réunion\u0007.pdf')).toBe('PV réunion .pdf');
    expect(cleanFileName('../../etc/passwd')).toBe('passwd');
  });

  it('donne un nom de repli', () => {
    expect(cleanFileName('')).toBe('document');
    expect(cleanFileName(null)).toBe('document');
    expect(cleanFileName('..')).toBe('document');
  });

  it('raccourcit en gardant l’extension', () => {
    const name = cleanFileName(`${'a'.repeat(300)}.docx`);
    expect(name.length).toBeLessThanOrEqual(150);
    expect(name.endsWith('.docx')).toBe(true);
  });
});

describe('contentDispositionFor', () => {
  it('propose le nom d’origine en UTF-8 avec un repli ASCII', () => {
    const header = contentDispositionFor('PV réunion « bureau ».pdf', false);
    expect(header).toContain('attachment; filename="PV r_union _ bureau _.pdf"');
    expect(header).toContain("filename*=UTF-8''PV%20r%C3%A9union");
  });

  it('inline pour ouvrir dans le navigateur', () => {
    expect(contentDispositionFor('a.pdf', true).startsWith('inline;')).toBe(true);
  });

  it('ne laisse passer ni guillemet, ni pour-cent, ni apostrophe non encodée', () => {
    const header = contentDispositionFor('l\'"a%b(1)*.pdf', false);
    const ascii = /filename="([^"]*)"/.exec(header)![1];
    expect(ascii).not.toMatch(/["%\\]/);
    expect(header.split("UTF-8''")[1]).not.toMatch(/['()*]/);
  });
});

describe('titleFromFileName', () => {
  it('reprend le nom sans extension, tirets bas en espaces', () => {
    expect(titleFromFileName('PV_reunion_octobre.docx')).toBe('PV reunion octobre');
    expect(titleFromFileName('')).toBe('document');
  });
});

describe('opensInBrowser', () => {
  it('PDF et images s’ouvrent, les fichiers Office s’enregistrent', () => {
    expect(opensInBrowser('application/pdf')).toBe(true);
    expect(opensInBrowser('image/png')).toBe(true);
    expect(opensInBrowser('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(false);
  });
});

describe('parseDocumentDate', () => {
  it('lit une date valide à minuit UTC', () => {
    expect(parseDocumentDate('2026-10-12')?.toISOString()).toBe('2026-10-12T00:00:00.000Z');
  });
  it('vide → null', () => {
    expect(parseDocumentDate('')).toBeNull();
    expect(parseDocumentDate(undefined)).toBeNull();
  });
  it('refuse une forme ou une date impossible', () => {
    expect(parseDocumentDate('12/10/2026')).toBeUndefined();
    expect(parseDocumentDate('2026-02-31')).toBeUndefined();
  });
});

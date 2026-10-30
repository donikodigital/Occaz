// backend/src/i18n/server-text.spec.ts
// Traduction des textes du serveur : le français est la clé ; trous, valeurs, dates et repli ne doivent jamais casser un message.
import { localizeValue, translateDeep, translateMessage, translateText } from './server-text';

describe('translateText', () => {
  it('le français reste intact (même un texte inconnu)', () => {
    expect(translateText('Aucune réservation pour le moment.', 'fr')).toBe('Aucune réservation pour le moment.');
    expect(translateText('Un texte que personne n’a traduit.', 'en-GB')).toBe('Un texte que personne n’a traduit.');
    expect(translateText('', 'pt-PT')).toBe('');
  });

  it('texte exact, dans les deux langues', () => {
    expect(translateText('Aucune réservation pour le moment.', 'en-GB')).toBe('No bookings at the moment.');
    expect(translateText('Aucune réservation pour le moment.', 'pt-PT')).toBe('Nenhuma reserva de momento.');
  });

  it('apostrophes courbes et droites sont équivalentes', () => {
    expect(translateText('Ce billet est introuvable.', 'en-GB')).toBe('This ticket cannot be found.');
    expect(translateText('Ce QR code n\'est pas un billet Occa\'Z valide.', 'en-GB')).toBe('This QR code is not a valid Occa’Z ticket.');
  });

  it('modèle à trous : les valeurs (villes, nombres) sont gardées', () => {
    expect(translateText('3 places réservées sur votre trajet Conakry → Kindia.', 'en-GB')).toBe('3 seats booked on your trip Conakry → Kindia.');
    expect(translateText('1 place réservée sur votre trajet Conakry → Kindia.', 'pt-PT')).toBe('1 lugar reservado na sua viagem Conakry → Kindia.');
  });

  it('un code et une durée restent à leur place', () => {
    expect(translateText("Occa'Z : 123456 est votre code de vérification. Valable 10 min. Ne le communiquez à personne.", 'en-GB')).toBe(
      "Occa'Z: 123456 is your verification code. Valid for 10 min. Do not share it with anyone.",
    );
  });

  it('les valeurs qui sont du français connu sont traduites à leur tour', () => {
    expect(translateText('Signalez d\'abord votre arrivée à la prochaine étape : des clients y montent ou y descendent.', 'en-GB')).toBe(
      'Report your arrival at the next stop first: customers are boarding or getting off there.',
    );
    // Portugais : « a » + « a próxima paragem » se contracte.
    expect(translateText('Signalez d\'abord votre arrivée à la prochaine étape : des clients y montent ou y descendent.', 'pt-PT')).toBe(
      'Comunique primeiro a sua chegada à próxima paragem: há clientes a embarcar ou a desembarcar aí.',
    );
  });

  it('une liste de pièces est traduite élément par élément', () => {
    const fr =
      'Le délai de 7 jours pour régulariser votre dossier est dépassé. Envoyez : photo de profil, permis de conduire et carte grise du véhicule. Vous pourrez de nouveau créer des trajets dès que ces pièces seront envoyées.';
    expect(translateText(fr, 'en-GB')).toContain('profile photo, driving licence and vehicle registration document');
    expect(translateText(fr, 'pt-PT')).toContain('fotografia de perfil, carta de condução e documento único automóvel do veículo');
  });

  it('singulier et pluriel ont leur propre ligne', () => {
    expect(translateText('Le délai de 1 jour pour régulariser votre dossier est dépassé. Envoyez : permis de conduire. Vous pourrez de nouveau créer des trajets dès que ces pièces seront envoyées.', 'pt-PT')).toContain('O prazo de 1 dia');
    expect(translateText('Par sécurité, votre retrait de 5 000 GNF vers ••••1234 (nouveau numéro) sera envoyé automatiquement dans 1 minute. Ce n\'est pas vous ? Annulez-le tout de suite depuis votre historique de retraits.', 'en-GB')).toContain('in 1 minute.');
  });

  it('un trou « chiffres seulement » ne capte pas un texte quelconque', () => {
    expect(translateText('Vos 3 colis ont été livrés à Kindia. Merci d\'avoir utilisé Occa\'Z.', 'en-GB')).toBe(
      'Your 3 parcels have been delivered to Kindia. Thank you for using Occa\'Z.',
    );
    // « Retirez le colis » finit par « colis » mais n'est pas « {n} colis » : jamais un demi-texte traduit.
    expect(translateText('Retirez le colis', 'en-GB')).toBe('Retirez le colis');
  });

  it('un e-mail sur plusieurs lignes est traduit ligne par ligne, les lignes vides sont gardées', () => {
    const fr = 'Bonjour Awa,\n\nTrajet : Conakry → Kindia\nPlaces : 2\nRéférence : OCZ-1';
    expect(translateText(fr, 'en-GB')).toBe('Hello Awa,\n\nTrip: Conakry → Kindia\nSeats: 2\nReference: OCZ-1');
    expect(translateText(fr, 'pt-PT')).toBe('Olá Awa,\n\nViagem: Conakry → Kindia\nLugares: 2\nReferência: OCZ-1');
  });

  it('un message de plusieurs phrases est traduit phrase par phrase, les phrases inconnues restent en français', () => {
    const result = translateText('Aucune réservation pour le moment. Phrase inconnue de la table.', 'en-GB');
    expect(result).toBe('No bookings at the moment. Phrase inconnue de la table.');
  });

  it('le texte d\'une notification partagé avec l\'application est reconnu', () => {
    expect(translateText('Votre trajet Conakry → Kindia part demain à 14 h 30. Soyez au point de rendez-vous quelques minutes avant.', 'pt-PT')).toBe(
      'A sua viagem Conakry → Kindia parte amanhã às 14:30. Esteja no ponto de encontro alguns minutos antes.',
    );
  });
});

describe('localizeValue', () => {
  it('dates, jours de la semaine et heures', () => {
    expect(localizeValue('mardi 3 novembre 2026', 'en-GB')).toBe('Tuesday 3 November 2026');
    expect(localizeValue('mardi 3 novembre 2026', 'pt-PT')).toBe('terça-feira, 3 de novembro de 2026');
    expect(localizeValue('1er décembre', 'en-GB')).toBe('1 December');
    expect(localizeValue('14 h 30', 'en-GB')).toBe('14:30');
    expect(localizeValue('demain à 14:30', 'pt-PT')).toBe('amanhã às 14:30');
    expect(localizeValue('aujourd’hui à 09:05', 'en-GB')).toBe('today at 09:05');
    expect(localizeValue('le 12 octobre à 08:00', 'en-GB')).toBe('on 12 October at 08:00');
    expect(localizeValue(' à 14:30', 'en-GB')).toBe(' at 14:30');
  });

  it('un nom ou une ville n\'est jamais touché', () => {
    expect(localizeValue('Mamou', 'en-GB')).toBe('Mamou');
    expect(localizeValue('Demain Diallo', 'en-GB')).toBe('Demain Diallo');
    expect(localizeValue('Fatoumata Mai', 'pt-PT')).toBe('Fatoumata Mai');
  });
});

describe('translateMessage / translateDeep', () => {
  it('une phrase, une liste d\'erreurs de validation, ou autre chose (rendu tel quel)', () => {
    expect(translateMessage('Ce billet est introuvable.', 'en-GB')).toBe('This ticket cannot be found.');
    expect(translateMessage(['Adresse e-mail invalide.', 42], 'pt-PT')).toEqual(['Endereço de e-mail inválido.', 42]);
    expect(translateMessage({ a: 1 }, 'en-GB')).toEqual({ a: 1 });
    expect(translateMessage('Ce billet est introuvable.', 'fr')).toBe('Ce billet est introuvable.');
  });

  it('une réponse imbriquée : textes traduits, dates et nombres gardés', () => {
    const at = new Date('2026-10-30T10:00:00Z');
    const view = { headline: 'Envoi remboursé', count: 2, at, events: [{ label: 'Un conducteur a accepté le colis', at }] };
    expect(translateDeep(view, 'en-GB')).toEqual({ headline: 'Shipment refunded', count: 2, at, events: [{ label: 'A driver has accepted the parcel', at }] });
    expect(translateDeep(view, 'fr')).toBe(view);
    expect(translateDeep(view, 'en-GB').at).toBe(at);
  });
});

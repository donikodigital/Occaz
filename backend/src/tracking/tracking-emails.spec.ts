// backend/src/tracking/tracking-emails.spec.ts
import { EMAIL_AUDIENCES, isTrackedStatus, passageNotification, statusNotification, trackingEmail, type TrackingEmailContext } from './tracking-emails';

const base: TrackingEmailContext = {
  audience: 'RECIPIENT',
  status: 'PICKED_UP',
  firstName: 'Aïssatou',
  senderName: 'Boubacar BARRY',
  pickupCity: 'Conakry',
  deliveryCity: 'Labé',
  driverFirstName: 'Mamadou',
  parcelsCount: 1,
  trackingNumber: 'OCZ 7F3A 91C2 B0',
  trackingUrl: 'https://app.occaz.example/suivi/OCZ7F3A91C2B0',
};

describe('trackingEmail', () => {
  it('prévient le destinataire quand un colis lui est destiné, avec le lien de suivi', () => {
    const { subject, body } = trackingEmail({ ...base, status: 'DRIVER_ASSIGNED' });
    expect(subject).toContain('Un colis vous est destiné');
    expect(subject).toContain('OCZ 7F3A 91C2 B0');
    expect(body).toContain('Bonjour Aïssatou,');
    expect(body).toContain('Boubacar BARRY vous envoie un colis (Conakry → Labé)');
    expect(body).toContain('https://app.occaz.example/suivi/OCZ7F3A91C2B0');
  });

  it('sans adresse publique configurée : le numéro et la marche à suivre, pas de lien cassé', () => {
    const { body } = trackingEmail({ ...base, trackingUrl: null });
    expect(body).toContain('OCZ 7F3A 91C2 B0');
    expect(body).toContain('Suivre un colis');
    expect(body).not.toContain('http');
  });

  it('accorde le pluriel pour plusieurs colis', () => {
    const { body } = trackingEmail({ ...base, status: 'DRIVER_ASSIGNED', parcelsCount: 3 });
    expect(body).toContain('3 colis');
  });

  it('à la livraison imminente, annonce le code par SMS sans jamais le contenir', () => {
    const { body } = trackingEmail({ ...base, status: 'DELIVERY_PENDING' });
    expect(body).toContain('SMS');
    expect(body).not.toMatch(/\b\d{6}\b/);
  });

  it('écrit à l\'expéditeur autrement qu\'au destinataire', () => {
    const sender = trackingEmail({ ...base, audience: 'SENDER', firstName: 'Boubacar' });
    expect(sender.subject).toContain('Colis récupéré');
    expect(sender.body).toContain('a récupéré votre colis à Conakry');
    const recipient = trackingEmail(base);
    expect(recipient.subject).toContain('en route');
  });

  it('ne donne au destinataire ni téléphone ni code', () => {
    for (const status of ['DRIVER_ASSIGNED', 'PICKED_UP', 'DELIVERY_PENDING', 'DELIVERED'] as const) {
      const { body } = trackingEmail({ ...base, status });
      expect(body).not.toMatch(/\+?\d{9,}/);
    }
  });

  it('n\'écrit pas « null » quand le conducteur est inconnu', () => {
    const { body } = trackingEmail({ ...base, driverFirstName: null });
    expect(body).not.toContain('null');
    expect(body).toContain('Le conducteur');
  });
});

describe('audiences', () => {
  it('l\'expéditeur n\'est pas prévenu deux fois : conducteur trouvé et livraison ont déjà leur notification', () => {
    expect(EMAIL_AUDIENCES.DRIVER_ASSIGNED).toEqual(['RECIPIENT']);
    expect(EMAIL_AUDIENCES.DELIVERED).toEqual(['RECIPIENT']);
    expect(EMAIL_AUDIENCES.PICKED_UP).toEqual(['SENDER', 'RECIPIENT']);
  });

  it('seules les étapes prévues sont suivies', () => {
    expect(isTrackedStatus('PICKED_UP')).toBe(true);
    expect(isTrackedStatus('IN_TRANSIT')).toBe(false);
    expect(isTrackedStatus('COMPLETED')).toBe(false);
  });
});

describe('notifications dans l\'application', () => {
  it('annonce le passage dans une ville', () => {
    expect(passageNotification('Kindia', 'OCZ 7F3A 91C2 B0').body).toBe('Votre colis (OCZ 7F3A 91C2 B0) vient de passer par Kindia.');
  });

  it('ne notifie que la prise en charge et l\'arrivée', () => {
    const params = { deliveryCity: 'Labé', driverFirstName: 'Mamadou' };
    expect(statusNotification('PICKED_UP', params)?.title).toBe('Colis récupéré');
    expect(statusNotification('DELIVERY_PENDING', params)?.body).toContain('Labé');
    expect(statusNotification('DRIVER_ASSIGNED', params)).toBeNull();
    expect(statusNotification('DELIVERED', params)).toBeNull();
  });
});

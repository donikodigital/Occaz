// backend/src/i18n/notification-text.ts
// [30/10/2026] v1 — Traduction des textes de notification du serveur (titres et corps), reprise de l'application (mobile/src/i18n/
// notificationText.ts) : même table de modèles français → anglais / portugais, pour que le push, le SMS et l'e-mail partent dans la langue
// du destinataire comme l'inbox de l'application s'affiche dans la sienne. POUR TRADUIRE UN NOUVEAU TEXTE DE NOTIFICATION : ajouter la ligne
// ici ET dans le fichier de l'application (ou, pour un texte hors notification, dans src/i18n/texts/).
import type { AppLanguage } from './language';

type TranslationParams = Record<string, string | number | null | undefined>;

interface Texts {
  en: string;
  pt: string;
}

const norm = (value: string) => value.replace(/’/g, "'");

/** Langue du texte en cours de traduction (la fonction est synchrone : aucune autre traduction ne s'intercale). */
let activeLanguage: AppLanguage = 'fr';

function intlLocale(): 'fr-FR' | 'en-GB' | 'pt-PT' {
  return activeLanguage === 'fr' ? 'fr-FR' : activeLanguage;
}

function pick(texts: Texts): string {
  return activeLanguage === 'en-GB' ? texts.en : activeLanguage === 'pt-PT' ? texts.pt : '';
}

function fill(text: string, params: TranslationParams): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

// ---------------------------------------------------------------------------
// Valeurs qui changent d'une notification à l'autre : recomposées dans la langue choisie
// ---------------------------------------------------------------------------

const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function monthIndex(name: string): number {
  return FR_MONTHS.indexOf(name.toLowerCase());
}

/** « 12 octobre » (avec ou sans année) → « 12 October », « 12 de outubro »… ; inchangé si la date n'est pas reconnue. */
function localizeDate(value: string): string {
  const match = /^(\d{1,2})(?:er)? (\S+)(?: (\d{4}))?$/.exec(value.trim());
  if (!match) return value;
  const month = monthIndex(match[2]);
  if (month < 0) return value;
  const year = match[3] ? Number(match[3]) : 2000;
  const options: Intl.DateTimeFormatOptions = match[3] ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' };
  try {
    return new Intl.DateTimeFormat(intlLocale(), options).format(new Date(year, month, Number(match[1])));
  } catch {
    return value;
  }
}

/** « 14 h 30 » → « 14:30 ». */
function localizeClock(value: string): string {
  const match = /^(\d{1,2}) h (\d{2})$/.exec(value.trim());
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : value;
}

const WHEN_TEXTS = {
  today: { en: 'today at {time}', pt: 'hoje às {time}' },
  tomorrow: { en: 'tomorrow at {time}', pt: 'amanhã às {time}' },
  on: { en: 'on {date} at {time}', pt: 'em {date} às {time}' },
};

/** « aujourd'hui à 14 h 30 », « demain à 09 h 00 », « le 12 octobre à 14 h 30 ». */
function localizeWhen(value: string): string {
  const match = /^(aujourd'hui|demain|le (\d{1,2}(?:er)? \S+)) à (\d{1,2} h \d{2})$/.exec(norm(value).trim());
  if (!match) return value;
  const time = localizeClock(match[3]);
  if (match[1] === "aujourd'hui") return fill(pick(WHEN_TEXTS.today), { time });
  if (match[1] === 'demain') return fill(pick(WHEN_TEXTS.tomorrow), { time });
  return fill(pick(WHEN_TEXTS.on), { date: localizeDate(match[2]), time });
}

/** « 126 323 XOF » → « 126,323 XOF » (séparateur de la langue choisie) ; le reste du texte est laissé tel quel. */
function localizeMoney(value: string): string {
  return value.replace(/(\d{1,3}(?:[\s  ]\d{3})*|\d+)([\s  ]+)([A-Z]{3})\b/g, (_m, digits: string, _space: string, code: string) => {
    const number = Number(digits.replace(/[\s  ]/g, ''));
    return Number.isFinite(number) ? `${new Intl.NumberFormat(intlLocale()).format(number)} ${code}` : _m;
  });
}

const COUNT_TEXTS = {
  daysLeft: { one: { en: 'You have {n} day left', pt: 'Falta {n} dia' }, other: { en: 'You have {n} days left', pt: 'Faltam {n} dias' } },
  lastDay: { en: 'Last day', pt: 'Último dia' },
  days: { one: { en: '{n} day', pt: '{n} dia' }, other: { en: '{n} days', pt: '{n} dias' } },
  inDays: { one: { en: 'in {n} day', pt: 'dentro de {n} dia' }, other: { en: 'in {n} days', pt: 'dentro de {n} dias' } },
  verySoon: { en: 'very soon', pt: 'muito em breve' },
  bookings: {
    one: { en: '{n} booking confirmed.', pt: '{n} reserva confirmada.' },
    other: { en: '{n} bookings confirmed.', pt: '{n} reservas confirmadas.' },
  },
  none: { en: 'No bookings yet.', pt: 'Ainda sem reservas.' },
};

function counted(texts: { one: Texts; other: Texts }, n: number): string {
  return fill(pick(n === 1 ? texts.one : texts.other), { n });
}

const LABELS: Record<string, Texts> = {
  'photo de profil': { en: 'profile photo', pt: 'fotografia de perfil' },
  'permis de conduire': { en: 'driving licence', pt: 'carta de condução' },
  véhicule: { en: 'vehicle', pt: 'veículo' },
  'carte grise du véhicule': { en: 'vehicle registration document', pt: 'documento único automóvel do veículo' },
};

/** « photo de profil, permis de conduire et carte grise du véhicule » → liste dans la langue choisie. */
function localizeLabels(value: string): string {
  const parts = value.split(/, | et /).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return value;
  const translated = parts.map((part) => (LABELS[part] ? pick(LABELS[part]) : part));
  if (translated.length === 1) return translated[0];
  const and = activeLanguage === 'pt-PT' ? ' e ' : ' and ';
  return `${translated.slice(0, -1).join(', ')}${and}${translated[translated.length - 1]}`;
}

// Un seul mot ou une seule expression, traduits quand ils apparaissent comme valeur.
const WORDS: Record<string, Texts> = {
  'Le conducteur': { en: 'The driver', pt: 'O condutor' },
  'un courrier': { en: 'a letter', pt: 'uma carta' },
  'un colis': { en: 'a parcel', pt: 'uma encomenda' },
  'votre compte Mobile Money': { en: 'your Mobile Money account', pt: 'a sua conta Mobile Money' },
  'raison non précisée': { en: 'no reason given', pt: 'motivo não indicado' },
  Colis: { en: 'Parcel', pt: 'Encomenda' },
  Courrier: { en: 'Letter', pt: 'Carta' },
  Documents: { en: 'Documents', pt: 'Documentos' },
};

function localizeWord(value: string): string {
  return WORDS[value] ? pick(WORDS[value]) : value;
}

/** Ce qu'on fait de la valeur capturée pour chaque variable (les autres variables gardent leur valeur : villes, noms, montants bruts). */
const FIXERS: Record<string, (value: string) => string> = {
  when: localizeWhen,
  clock: localizeClock,
  date: localizeDate,
  amount: localizeMoney,
  labels: localizeLabels,
  driver: localizeWord,
  thing: localizeWord,
  masked: localizeWord,
  reason: localizeWord,
  category: localizeWord,
  bookings: (value) => {
    if (value === 'Aucune réservation pour le moment.') return pick(COUNT_TEXTS.none);
    const match = /^(\d+) réservations? confirmées?\.$/.exec(value);
    return match ? counted(COUNT_TEXTS.bookings, Number(match[1])) : value;
  },
  left: (value) => {
    if (value === 'Dernier jour') return pick(COUNT_TEXTS.lastDay);
    const match = /^Il vous reste (\d+) jours?$/.exec(value);
    return match ? counted(COUNT_TEXTS.daysLeft, Number(match[1])) : value;
  },
  days: (value) => {
    const match = /^(\d+) jours?$/.exec(value);
    return match ? counted(COUNT_TEXTS.days, Number(match[1])) : value;
  },
  deadline: (value) => {
    if (value === 'très bientôt') return pick(COUNT_TEXTS.verySoon);
    const match = /^dans (\d+) jours?$/.exec(value);
    return match ? counted(COUNT_TEXTS.inDays, Number(match[1])) : value;
  },
};

// ---------------------------------------------------------------------------
// Textes fixes
// ---------------------------------------------------------------------------

const STATIC_TEXTS: Record<string, Texts> = {
  // Titres
  'Le conducteur est arrivé': { en: 'Your driver has arrived', pt: 'O seu condutor chegou' },
  "Bienvenue chez Occa'Z": { en: "Welcome to Occa'Z", pt: "Bem-vindo à Occa'Z" },
  'Nous mettons à jour notre application': { en: 'We are updating our app', pt: 'Estamos a atualizar a nossa aplicação' },
  'Message du service client': { en: 'Message from customer service', pt: 'Mensagem do apoio ao cliente' },
  'Votre alerte a été reçue': { en: 'Your alert has been received', pt: 'O seu alerta foi recebido' },
  'Réservation annulée': { en: 'Booking cancelled', pt: 'Reserva cancelada' },
  'Trajet annulé': { en: 'Trip cancelled', pt: 'Viagem cancelada' },
  'Rappel de votre trajet': { en: 'Reminder for your trip', pt: 'Lembrete da sua viagem' },
  'Votre départ approche': { en: 'Your departure is approaching', pt: 'A sua partida está a aproximar-se' },
  'Rappel de départ': { en: 'Departure reminder', pt: 'Lembrete de partida' },
  'Votre code est prêt': { en: 'Your code is ready', pt: 'O seu código está pronto' },
  'Bon voyage !': { en: 'Have a good trip!', pt: 'Boa viagem!' },
  'Bienvenue !': { en: 'Welcome!', pt: 'Bem-vindo!' },
  'Réservation clôturée : vous n\'étiez pas au rendez-vous': { en: 'Booking closed: you were not at the meeting point', pt: 'Reserva encerrada: não compareceu ao ponto de encontro' },
  'Client absent : vous êtes payé': { en: 'Customer absent: you are paid', pt: 'Cliente ausente: foi pago' },
  'Paiement reçu': { en: 'Payment received', pt: 'Pagamento recebido' },
  'Compte validé': { en: 'Account approved', pt: 'Conta validada' },
  "Aucun conducteur pour l'instant": { en: 'No driver for now', pt: 'Ainda sem condutor' },
  'Votre code de remise est prêt': { en: 'Your hand-over code is ready', pt: 'O seu código de entrega está pronto' },
  'Colis livré': { en: 'Parcel delivered', pt: 'Encomenda entregue' },
  'Conducteur trouvé': { en: 'Driver found', pt: 'Condutor encontrado' },
  'Envoi annulé': { en: 'Shipment cancelled', pt: 'Envio cancelado' },
  'Un conducteur ne peut pas prendre votre colis': { en: 'A driver cannot take your parcel', pt: 'Um condutor não pode levar a sua encomenda' },
  'Envoi urgent à transporter': { en: 'Urgent shipment to carry', pt: 'Envio urgente para transportar' },
  "Nouvelle demande d'envoi": { en: 'New shipment request', pt: 'Novo pedido de envio' },
  'Nouveau message — litige': { en: 'New message — dispute', pt: 'Nova mensagem — litígio' },
  'Litige résolu': { en: 'Dispute resolved', pt: 'Litígio resolvido' },
  'Paiement confirmé': { en: 'Payment confirmed', pt: 'Pagamento confirmado' },
  'Nouvelle réservation': { en: 'New booking', pt: 'Nova reserva' },
  'Remboursement effectué': { en: 'Refund issued', pt: 'Reembolso efetuado' },
  'Véhicule validé': { en: 'Vehicle approved', pt: 'Veículo validado' },
  'Véhicule refusé': { en: 'Vehicle rejected', pt: 'Veículo recusado' },
  'Retrait programmé': { en: 'Withdrawal scheduled', pt: 'Levantamento agendado' },
  'Retrait effectué': { en: 'Withdrawal completed', pt: 'Levantamento efetuado' },
  'Retrait refusé': { en: 'Withdrawal refused', pt: 'Levantamento recusado' },
  'Retrait validé': { en: 'Withdrawal approved', pt: 'Levantamento aprovado' },
  'Votre colis avance': { en: 'Your parcel is on its way', pt: 'A sua encomenda está a caminho' },
  'Colis récupéré': { en: 'Parcel picked up', pt: 'Encomenda recolhida' },
  'Votre colis est arrivé': { en: 'Your parcel has arrived', pt: 'A sua encomenda chegou' },
  'Création de trajets suspendue': { en: 'Trip creation suspended', pt: 'Criação de viagens suspensa' },
  'Complétez votre dossier conducteur': { en: 'Complete your driver file', pt: 'Complete o seu processo de condutor' },
  'Ajoutez votre adresse e-mail': { en: 'Add your email address', pt: 'Adicione o seu endereço de e-mail' },
  'Pensez à votre adresse e-mail': { en: 'Remember your email address', pt: 'Lembre-se do seu endereço de e-mail' },
  "Votre compte Occa'Z est suspendu": { en: 'Your Occa\'Z account is suspended', pt: 'A sua conta Occa\'Z está suspensa' },
  "Dernier rappel : votre compte Occa'Z va être supprimé": { en: 'Final reminder: your Occa\'Z account will be deleted', pt: 'Último lembrete: a sua conta Occa\'Z vai ser eliminada' },
  'Notification': { en: 'Notification', pt: 'Notificação' },

  // Corps sans variable
  'Nous mettons à jour notre application.': { en: 'We are updating our app.', pt: 'Estamos a atualizar a nossa aplicação.' },
  "L'équipe Occa'Z a pris votre alerte en compte. Si vous êtes en danger immédiat, appelez aussi les secours.": {
    en: "The Occa'Z team has taken your alert into account. If you are in immediate danger, please also call the emergency services.",
    pt: "A equipa Occa'Z registou o seu alerta. Se estiver em perigo imediato, ligue também para os serviços de emergência.",
  },
  "Votre conducteur vous demande votre code de prise en charge. Ouvrez « Voir mon code » sur votre réservation, puis donnez-le lui.": {
    en: 'Your driver is asking for your pick-up code. Open “View my code” on your booking, then give it to them.',
    pt: 'O seu condutor pede o seu código de recolha. Abra «Ver o meu código» na sua reserva e dê-lho.',
  },
  "Votre conducteur vous demande votre code de dépose. Ouvrez « Voir mon code » sur votre réservation, puis donnez-le lui.": {
    en: 'Your driver is asking for your drop-off code. Open “View my code” on your booking, then give it to them.',
    pt: 'O seu condutor pede o seu código de largada. Abra «Ver o meu código» na sua reserva e dê-lho.',
  },
  "N'oubliez pas d'attacher votre ceinture de sécurité. Nous vous souhaitons un bon voyage.": {
    en: 'Remember to fasten your seat belt. We wish you a pleasant journey.',
    pt: 'Não se esqueça de apertar o cinto de segurança. Desejamos-lhe uma boa viagem.',
  },
  "Vous avez attendu votre client : le montant de la réservation est ajouté à votre solde disponible.": {
    en: 'You waited for your customer: the booking amount has been added to your available balance.',
    pt: 'Esperou pelo seu cliente: o valor da reserva foi adicionado ao seu saldo disponível.',
  },
  'Votre profil conducteur a été vérifié — vous pouvez maintenant proposer des trajets.': {
    en: 'Your driver profile has been verified — you can now offer trips.',
    pt: 'O seu perfil de condutor foi verificado — já pode propor viagens.',
  },
  "Votre conducteur est là pour récupérer le colis. Ouvrez « Voir mon code » sur votre envoi, puis donnez-le lui.": {
    en: 'Your driver is here to collect the parcel. Open “View my code” on your shipment, then give it to them.',
    pt: 'O seu condutor está aqui para recolher a encomenda. Abra «Ver o meu código» no seu envio e dê-lho.',
  },
  'Votre envoi a été livré avec succès.': { en: 'Your shipment has been delivered successfully.', pt: 'O seu envio foi entregue com sucesso.' },
  'Un conducteur a accepté de transporter votre envoi.': { en: 'A driver has agreed to carry your shipment.', pt: 'Um condutor aceitou transportar o seu envio.' },
  "Cet envoi a été annulé : vous n'avez plus à le récupérer.": {
    en: 'This shipment has been cancelled: you no longer need to collect it.',
    pt: 'Este envio foi cancelado: já não tem de o recolher.',
  },
  'Le conducteur a annulé votre envoi. Votre paiement vous est remboursé intégralement.': {
    en: 'The driver has cancelled your shipment. Your payment will be refunded in full.',
    pt: 'O condutor cancelou o seu envio. O seu pagamento será reembolsado na íntegra.',
  },
  'Votre envoi a été annulé. Votre paiement vous est remboursé intégralement.': {
    en: 'Your shipment has been cancelled. Your payment will be refunded in full.',
    pt: 'O seu envio foi cancelado. O seu pagamento será reembolsado na íntegra.',
  },
  'Pas de souci : invitez un autre conducteur, votre colis reste visible de tous les conducteurs.': {
    en: 'No worries: invite another driver, your parcel remains visible to all drivers.',
    pt: 'Sem problema: convide outro condutor, a sua encomenda continua visível para todos os condutores.',
  },
  'Votre paiement a été confirmé — votre réservation est validée.': {
    en: 'Your payment has been confirmed — your booking is validated.',
    pt: 'O seu pagamento foi confirmado — a sua reserva está validada.',
  },
  'Votre paiement a été confirmé — nous recherchons un conducteur pour votre envoi.': {
    en: 'Your payment has been confirmed — we are looking for a driver for your shipment.',
    pt: 'O seu pagamento foi confirmado — estamos à procura de um condutor para o seu envio.',
  },
  "Facultatif, mais utile : avec une adresse e-mail, vous pouvez récupérer votre compte plus facilement et recevoir vos reçus et rappels. Ajoutez-la depuis votre profil, en quelques secondes.": {
    en: 'Optional, but useful: with an email address you can recover your account more easily and receive your receipts and reminders. Add it from your profile in a few seconds.',
    pt: 'Facultativo, mas útil: com um endereço de e-mail pode recuperar a sua conta mais facilmente e receber recibos e lembretes. Adicione-o a partir do seu perfil, em poucos segundos.',
  },
  "Dernier rappel : une adresse e-mail protège l'accès à votre compte et vous garantit de ne manquer aucune information importante. Vous pouvez l'ajouter depuis votre profil.": {
    en: 'Final reminder: an email address protects access to your account and ensures you do not miss any important information. You can add it from your profile.',
    pt: 'Último lembrete: um endereço de e-mail protege o acesso à sua conta e garante que não perde nenhuma informação importante. Pode adicioná-lo a partir do seu perfil.',
  },
};

// ---------------------------------------------------------------------------
// Textes à trous — du plus long au plus court : le premier modèle reconnu l'emporte
// ---------------------------------------------------------------------------

const PATTERNS: Array<[template: string, texts: Texts]> = [
  // --- Départ, arrivée, code ---
  [
    "Votre conducteur vous attend au point de départ de {route}. Donnez-lui votre code de prise en charge (bouton « Voir mon code » dans l'application).",
    {
      en: 'Your driver is waiting at the departure point of {route}. Give them your pick-up code (“View my code” button in the app).',
      pt: 'O seu condutor está à espera no ponto de partida de {route}. Dê-lhe o seu código de recolha (botão «Ver o meu código» na aplicação).',
    },
  ],
  [
    "Votre conducteur est arrivé à {place}. Donnez-lui votre code de prise en charge (bouton « Voir mon code » dans l'application).",
    {
      en: 'Your driver has arrived at {place}. Give them your pick-up code (“View my code” button in the app).',
      pt: 'O seu condutor chegou a {place}. Dê-lhe o seu código de recolha (botão «Ver o meu código» na aplicação).',
    },
  ],
  [
    "Vous êtes arrivé à {place}. Donnez votre code de dépose à votre conducteur pour confirmer la fin de votre trajet (bouton « Voir mon code » dans l'application).",
    {
      en: 'You have arrived at {place}. Give your drop-off code to your driver to confirm the end of your trip (“View my code” button in the app).',
      pt: 'Chegou a {place}. Dê o seu código de largada ao condutor para confirmar o fim da viagem (botão «Ver o meu código» na aplicação).',
    },
  ],
  [
    "Vous êtes bien arrivé à {city}. Toute l'équipe Occa'Z vous souhaite un excellent séjour à {city} et vous remercie d'avoir voyagé avec nous.",
    {
      en: "You have arrived safely in {city}. The whole Occa'Z team wishes you an excellent stay in {city} and thanks you for travelling with us.",
      pt: "Chegou bem a {city}. Toda a equipa Occa'Z deseja-lhe uma excelente estadia em {city} e agradece por ter viajado connosco.",
    },
  ],
  [
    "Vous êtes bien arrivé. Toute l'équipe Occa'Z vous souhaite un excellent séjour et vous remercie d'avoir voyagé avec nous.",
    {
      en: "You have arrived safely. The whole Occa'Z team wishes you an excellent stay and thanks you for travelling with us.",
      pt: 'Chegou bem. Toda a equipa Occa\'Z deseja-lhe uma excelente estadia e agradece por ter viajado connosco.',
    },
  ],

  // --- Rappels de départ ---
  [
    'Votre trajet {route} part dans {delay} ({clock}). Gardez votre code de prise en charge à portée de main.',
    {
      en: 'Your trip {route} departs in {delay} ({clock}). Keep your pick-up code handy.',
      pt: 'A sua viagem {route} parte dentro de {delay} ({clock}). Tenha o seu código de recolha à mão.',
    },
  ],
  [
    'Votre trajet {route} part dans {delay} ({clock}). {bookings}',
    { en: 'Your trip {route} departs in {delay} ({clock}). {bookings}', pt: 'A sua viagem {route} parte dentro de {delay} ({clock}). {bookings}' },
  ],

  [
    'Votre trajet {route} part {when}. Soyez au point de rendez-vous quelques minutes avant.',
    {
      en: 'Your trip {route} departs {when}. Be at the meeting point a few minutes early.',
      pt: 'A sua viagem {route} parte {when}. Esteja no ponto de encontro alguns minutos antes.',
    },
  ],
  [
    'Votre trajet {route} part {when}. {bookings}',
    { en: 'Your trip {route} departs {when}. {bookings}', pt: 'A sua viagem {route} parte {when}. {bookings}' },
  ],
  // --- Annulations, absences ---
  [
    'Une réservation de 1 place a été annulée sur votre trajet {route}.',
    { en: 'A booking for 1 seat has been cancelled on your trip {route}.', pt: 'Uma reserva de 1 lugar foi cancelada na sua viagem {route}.' },
  ],
  [
    'Une réservation de {count} places a été annulée sur votre trajet {route}.',
    { en: 'A booking for {count} seats has been cancelled on your trip {route}.', pt: 'Uma reserva de {count} lugares foi cancelada na sua viagem {route}.' },
  ],
  [
    'Le trajet {route} du {date} a été annulé par le conducteur. Vous êtes remboursé intégralement.',
    {
      en: 'The trip {route} on {date} has been cancelled by the driver. You will be refunded in full.',
      pt: 'A viagem {route} de {date} foi cancelada pelo condutor. Será reembolsado na íntegra.',
    },
  ],
  [
    'Le conducteur vous a attendu sur le trajet {route} sans vous voir. La réservation est clôturée, sans remboursement. Si c\'est une erreur, utilisez « Signaler un problème » : notre équipe examinera votre situation.',
    {
      en: 'The driver waited for you on the trip {route} without seeing you. The booking is closed, without a refund. If this is a mistake, use “Report a problem”: our team will review your situation.',
      pt: 'O condutor esperou por si na viagem {route} sem o ver. A reserva está encerrada, sem reembolso. Se for um engano, utilize «Comunicar um problema»: a nossa equipa irá analisar a sua situação.',
    },
  ],

  // --- Réservations, paiements, remboursements ---
  [
    '1 place réservée sur votre trajet {route}.',
    { en: '1 seat booked on your trip {route}.', pt: '1 lugar reservado na sua viagem {route}.' },
  ],
  [
    '{count} places réservées sur votre trajet {route}.',
    { en: '{count} seats booked on your trip {route}.', pt: '{count} lugares reservados na sua viagem {route}.' },
  ],
  [
    '{amount} ont été ajoutés à votre solde disponible.',
    { en: '{amount} has been added to your available balance.', pt: '{amount} foram adicionados ao seu saldo disponível.' },
  ],
  [
    'Votre remboursement ({percentage}%) a été traité.',
    { en: 'Your refund ({percentage}%) has been processed.', pt: 'O seu reembolso ({percentage}%) foi processado.' },
  ],

  // --- Retraits ---
  [
    "Par sécurité, votre retrait de {amount} vers {masked} (nouveau numéro) sera envoyé automatiquement dans 1 minute. Ce n'est pas vous ? Annulez-le tout de suite depuis votre historique de retraits.",
    {
      en: 'For security, your withdrawal of {amount} to {masked} (new number) will be sent automatically in 1 minute. Not you? Cancel it right away from your withdrawal history.',
      pt: 'Por segurança, o seu levantamento de {amount} para {masked} (novo número) será enviado automaticamente dentro de 1 minuto. Não foi o próprio? Cancele-o já a partir do seu histórico de levantamentos.',
    },
  ],
  [
    "Par sécurité, votre retrait de {amount} vers {masked} (nouveau numéro) sera envoyé automatiquement dans {minutes} minutes. Ce n'est pas vous ? Annulez-le tout de suite depuis votre historique de retraits.",
    {
      en: 'For security, your withdrawal of {amount} to {masked} (new number) will be sent automatically in {minutes} minutes. Not you? Cancel it right away from your withdrawal history.',
      pt: 'Por segurança, o seu levantamento de {amount} para {masked} (novo número) será enviado automaticamente dentro de {minutes} minutos. Não foi o próprio? Cancele-o já a partir do seu histórico de levantamentos.',
    },
  ],
  [
    '{amount} ont été envoyés sur votre compte Mobile Money ({masked}).',
    { en: '{amount} has been sent to your Mobile Money account ({masked}).', pt: '{amount} foram enviados para a sua conta Mobile Money ({masked}).' },
  ],
  [
    'Votre retrait de {amount} a été refusé ({reason}). Le montant a été remis dans votre solde.',
    {
      en: 'Your withdrawal of {amount} was refused ({reason}). The amount has been returned to your balance.',
      pt: 'O seu levantamento de {amount} foi recusado ({reason}). O montante foi devolvido ao seu saldo.',
    },
  ],
  [
    "Votre retrait de {amount} a été validé : l'envoi vers {masked} est en cours.",
    {
      en: 'Your withdrawal of {amount} has been approved: the transfer to {masked} is in progress.',
      pt: 'O seu levantamento de {amount} foi aprovado: o envio para {masked} está em curso.',
    },
  ],

  // --- Profils, véhicules, dossier conducteur ---
  [
    'Bienvenue {name} ! Votre profil conducteur est en cours de vérification.',
    { en: 'Welcome {name}! Your driver profile is being verified.', pt: 'Bem-vindo, {name}! O seu perfil de condutor está em verificação.' },
  ],
  ['Bienvenue {name} ! Votre compte est prêt.', { en: 'Welcome {name}! Your account is ready.', pt: 'Bem-vindo, {name}! A sua conta está pronta.' }],
  [
    "Votre véhicule {vehicle} n'a pas été validé — vérifiez vos documents.",
    { en: 'Your vehicle {vehicle} was not approved — please check your documents.', pt: 'O seu veículo {vehicle} não foi validado — verifique os seus documentos.' },
  ],
  ['Votre véhicule {vehicle} a été vérifié.', { en: 'Your vehicle {vehicle} has been verified.', pt: 'O seu veículo {vehicle} foi verificado.' }],
  [
    "Le délai de {days} pour régulariser votre dossier est dépassé. Envoyez : {labels}. Dès que ces pièces sont envoyées, vous pouvez de nouveau créer des trajets. Les envois de colis s'ouvrent après la validation de votre dossier.",
    {
      en: 'The {days} period to regularise your file has expired. Please send: {labels}. As soon as these documents are sent, you can create trips again. Parcel shipments open once your file is approved.',
      pt: 'O prazo de {days} para regularizar o seu processo terminou. Envie: {labels}. Assim que estes documentos forem enviados, poderá voltar a criar viagens. Os envios de encomendas abrem após a validação do seu processo.',
    },
  ],
  [
    "{left} pour envoyer : {labels}. Passé ce délai, vous ne pourrez plus créer de trajets. Les envois de colis s'ouvrent après la validation de votre dossier.",
    {
      en: '{left} to send: {labels}. After this period, you will no longer be able to create trips. Parcel shipments open once your file is approved.',
      pt: '{left} para enviar: {labels}. Passado este prazo, já não poderá criar viagens. Os envios de encomendas abrem após a validação do seu processo.',
    },
  ],

  // --- Colis ---
  [
    "La période prévue pour votre envoi est terminée sans qu'un conducteur l'ait accepté. Prolongez-la dans l'application ; sans réponse de votre part sous {hours} h, vous serez remboursé intégralement.",
    {
      en: 'The period planned for your shipment has ended without a driver accepting it. Extend it in the app; if we hear nothing from you within {hours} h, you will be refunded in full.',
      pt: 'O período previsto para o seu envio terminou sem que um condutor o tenha aceitado. Prolongue-o na aplicação; sem resposta sua em {hours} h, será reembolsado na íntegra.',
    },
  ],
  [
    "{category} de {from} vers {to}, {weight} kg, jusqu'au {until}. Vous recevrez {amount}. Premier arrivé, premier servi.",
    {
      en: '{category} from {from} to {to}, {weight} kg, until {until}. You will receive {amount}. First come, first served.',
      pt: '{category} de {from} para {to}, {weight} kg, até {until}. Receberá {amount}. Por ordem de chegada.',
    },
  ],
  [
    "Bonjour {name},\n\nJ'ai préparé {thing} à envoyer à destination de {city}. J'ai vu que vous deviez effectuer ce trajet. Pourriez-vous l'accepter, s'il vous plaît ?\n\nJe vous remercie d'avance.\n\nOuvrez l'application Occa'Z pour accepter ou refuser. Le premier conducteur qui accepte prend le colis.",
    {
      en: "Hello {name},\n\nI have prepared {thing} to send to {city}. I saw that you were due to make this trip. Could you accept it, please?\n\nThank you in advance.\n\nOpen the Occa'Z app to accept or decline. The first driver to accept takes the parcel.",
      pt: "Olá {name},\n\nPreparei {thing} para enviar com destino a {city}. Vi que ia fazer esta viagem. Podia aceitá-lo, por favor?\n\nAgradeço desde já.\n\nAbra a aplicação Occa'Z para aceitar ou recusar. O primeiro condutor que aceitar leva a encomenda.",
    },
  ],
  [
    "Bonjour {name},\n\nJ'ai préparé {thing} à envoyer à destination de {city}. J'ai vu que vous deviez effectuer ce trajet. Pourriez-vous l'accepter, s'il vous plaît ?\n\nJe vous remercie d'avance.",
    {
      en: 'Hello {name},\n\nI have prepared {thing} to send to {city}. I saw that you were due to make this trip. Could you accept it, please?\n\nThank you in advance.',
      pt: 'Olá {name},\n\nPreparei {thing} para enviar com destino a {city}. Vi que ia fazer esta viagem. Podia aceitá-lo, por favor?\n\nAgradeço desde já.',
    },
  ],
  [
    '{driver} a récupéré votre colis. Suivez-le en direct dans l\'application.',
    { en: '{driver} has picked up your parcel. Follow it live in the app.', pt: '{driver} recolheu a sua encomenda. Acompanhe-a em direto na aplicação.' },
  ],
  [
    '{driver} est arrivé à {city} : la remise au destinataire est imminente.',
    { en: '{driver} has arrived in {city}: hand-over to the recipient is imminent.', pt: '{driver} chegou a {city}: a entrega ao destinatário é iminente.' },
  ],
  [
    'Votre colis ({tracking}) vient de passer par {city}.',
    { en: 'Your parcel ({tracking}) has just passed through {city}.', pt: 'A sua encomenda ({tracking}) acabou de passar por {city}.' },
  ],

  // --- Litiges ---
  [
    'Nouveau message sur le litige "{reason}".',
    { en: 'New message on the dispute "{reason}".', pt: 'Nova mensagem no litígio "{reason}".' },
  ],
  [
    'Le litige "{reason}" a été résolu ({resolution}).',
    { en: 'The dispute "{reason}" has been resolved ({resolution}).', pt: 'O litígio "{reason}" foi resolvido ({resolution}).' },
  ],

  // --- Suspension du compte ---
  [
    "Dernier rappel. Votre compte Occa'Z est suspendu depuis le {since}. Rapprochez-vous de l'administration pour vous mettre en conformité et le réactiver. Sans régularisation avant le {until} ({deadline}), votre compte et vos données seront définitivement supprimés, sans possibilité de les récupérer.",
    {
      en: "Final reminder. Your Occa'Z account has been suspended since {since}. Contact the administration to comply and reactivate it. Without regularisation before {until} ({deadline}), your account and your data will be permanently deleted, with no possibility of recovery.",
      pt: "Último lembrete. A sua conta Occa'Z está suspensa desde {since}. Contacte a administração para se pôr em conformidade e a reativar. Sem regularização antes de {until} ({deadline}), a sua conta e os seus dados serão eliminados definitivamente, sem possibilidade de recuperação.",
    },
  ],
  [
    "Votre compte Occa'Z est suspendu depuis le {since}. Rapprochez-vous de l'administration pour vous mettre en conformité et le réactiver. Sans régularisation avant le {until} ({deadline}), votre compte et vos données seront définitivement supprimés, sans possibilité de les récupérer.",
    {
      en: "Your Occa'Z account has been suspended since {since}. Contact the administration to comply and reactivate it. Without regularisation before {until} ({deadline}), your account and your data will be permanently deleted, with no possibility of recovery.",
      pt: "A sua conta Occa'Z está suspensa desde {since}. Contacte a administração para se pôr em conformidade e a reativar. Sem regularização antes de {until} ({deadline}), a sua conta e os seus dados serão eliminados definitivamente, sem possibilidade de recuperação.",
    },
  ],

  // --- Titres à trous (après les corps : un modèle court ne doit pas « avaler » un texte plus long) ---
  ['Vous êtes arrivé à {place}', { en: 'You have arrived at {place}', pt: 'Chegou a {place}' }],
  ['Bienvenue à {city} !', { en: 'Welcome to {city}!', pt: 'Bem-vindo a {city}!' }],
  ['Un colis à transporter vers {city}', { en: 'A parcel to carry to {city}', pt: 'Uma encomenda para transportar para {city}' }],
];

// Variables dont la valeur est une date ou un montant : même traitement que `date` / `amount`.
const FIXER_ALIASES: Record<string, string> = { since: 'date', until: 'date' };

interface CompiledPattern {
  re: RegExp;
  names: string[];
  texts: Texts;
}

function compile(template: string, texts: Texts): CompiledPattern {
  const names: string[] = [];
  const source = norm(template)
    .split(/(\{\w+\})/)
    .map((part) => {
      const match = /^\{(\w+)\}$/.exec(part);
      if (match) {
        names.push(match[1]);
        return '([\\s\\S]+?)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return { re: new RegExp(`^${source}$`), names, texts };
}

const COMPILED = PATTERNS.map(([template, texts]) => compile(template, texts));
const STATIC_BY_KEY = new Map(Object.entries(STATIC_TEXTS).map(([key, texts]) => [norm(key), texts]));

/** Ces valeurs sont des chiffres ou des noms propres : jamais traduites. */
function fixValue(name: string, value: string): string {
  const fixer = FIXERS[name] ?? FIXERS[FIXER_ALIASES[name] ?? ''];
  return fixer ? fixer(value) : value;
}

/**
 * Texte d'une notification (titre ou corps) dans la langue demandée, ou null si aucun modèle ne le reconnaît (le texte reste alors en
 * français). Même table que l'application (mobile/src/i18n/notificationText.ts), qui traduit à l'affichage les notifications déjà
 * enregistrées en français ; ici, on traduit le texte au moment de l'envoi (push, SMS, e-mail).
 */
export function tryTranslateNotificationText(text: string, language: AppLanguage): string | null {
  if (!text || language === 'fr') return null;
  activeLanguage = language;

  const normalised = norm(text);
  const fixed = STATIC_BY_KEY.get(normalised);
  if (fixed) return pick(fixed);

  for (const pattern of COMPILED) {
    const match = pattern.re.exec(normalised);
    if (!match) continue;
    const params: Record<string, string> = {};
    pattern.names.forEach((name, index) => {
      if (!(name in params)) params[name] = fixValue(name, match[index + 1]);
    });
    return fill(pick(pattern.texts), params);
  }
  return null;
}

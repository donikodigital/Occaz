// backend/src/i18n/texts/texts-compliance.ts
// [30/10/2026] v1 — Textes traduits (notifications, e-mails, SMS, PDF) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const TEXTS_COMPLIANCE: readonly TextRow[] = [
  ["photo de profil", "profile photo", "fotografia de perfil"],
  ["permis de conduire", "driving licence", "carta de condução"],
  ["carte grise du véhicule", "vehicle registration document", "documento único automóvel do veículo"],
  ["véhicule", "vehicle", "veículo"],
  ["Votre compte conducteur est suspendu : vous ne pouvez pas créer de trajet.", "Your driver account is suspended: you cannot create a trip.", "A sua conta de condutor está suspensa: não pode criar viagens."],
  ["Le délai de {0} jour pour régulariser votre dossier est dépassé. Envoyez : {1}. Vous pourrez de nouveau créer des trajets dès que ces pièces seront envoyées.", "The {0}-day deadline to bring your file into compliance has passed. Please send: {1}. You will be able to create trips again as soon as these documents are sent.", "O prazo de {0} dia para regularizar o seu processo foi ultrapassado. Envie: {1}. Poderá voltar a criar viagens assim que estes documentos forem enviados."],
  ["Le délai de {0} jours pour régulariser votre dossier est dépassé. Envoyez : {1}. Vous pourrez de nouveau créer des trajets dès que ces pièces seront envoyées.", "The {0}-day deadline to bring your file into compliance has passed. Please send: {1}. You will be able to create trips again as soon as these documents are sent.", "O prazo de {0} dias para regularizar o seu processo foi ultrapassado. Envie: {1}. Poderá voltar a criar viagens assim que estes documentos forem enviados."],
];

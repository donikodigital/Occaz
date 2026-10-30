// backend/src/i18n/texts/errors-profiles.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_PROFILES: readonly TextRow[] = [
  ["Aucun profil client pour cet utilisateur.", "No customer profile for this user.", "Nenhum perfil de cliente para este utilizador."],
  ["Aucun profil client — complétez d'abord votre inscription.", "No customer profile — complete your registration first.", "Nenhum perfil de cliente — conclua primeiro o seu registo."],
  ["Profil client introuvable.", "Customer profile not found.", "Perfil de cliente não encontrado."],
  ["Seul un compte client ou conducteur peut créer un profil client.", "Only a customer or driver account can create a customer profile.", "Só uma conta de cliente ou de condutor pode criar um perfil de cliente."],
  ["Un profil client existe déjà pour ce compte.", "A customer profile already exists for this account.", "Já existe um perfil de cliente para esta conta."],
  ["Cette adresse email est déjà utilisée par un autre compte.", "This e-mail address is already used by another account.", "Este endereço de e-mail já é utilizado por outra conta."],
  ["Profil conducteur introuvable.", "Driver profile not found.", "Perfil de condutor não encontrado."],
  ["Aucun profil conducteur — complétez d'abord votre inscription.", "No driver profile — complete your registration first.", "Nenhum perfil de condutor — conclua primeiro o seu registo."],
  ["Aucun profil conducteur pour cet utilisateur.", "No driver profile for this user.", "Nenhum perfil de condutor para este utilizador."],
  ["Seul un compte client ou conducteur peut créer un profil conducteur.", "Only a customer or driver account can create a driver profile.", "Só uma conta de cliente ou de condutor pode criar um perfil de condutor."],
  ["Un profil conducteur existe déjà pour ce compte.", "A driver profile already exists for this account.", "Já existe um perfil de condutor para esta conta."],
  ["Pays introuvable.", "Country not found.", "País não encontrado."],
  ["Le pays \"{0}\" n'a pas de devise par défaut configurée — impossible de créer le portefeuille du conducteur. Contactez un administrateur.", "The country \"{0}\" has no default currency configured — the driver's wallet cannot be created. Contact an administrator.", "O país \"{0}\" não tem moeda predefinida configurada — não é possível criar a carteira do condutor. Contacte um administrador."],
  ["Ce conducteur doit avoir une photo de profil avant de pouvoir être validé.", "This driver must have a profile photo before they can be validated.", "Este condutor tem de ter uma fotografia de perfil antes de poder ser validado."],
  ["Ce conducteur doit avoir envoyé son permis de conduire avant de pouvoir être validé.", "This driver must have uploaded their driving licence before they can be validated.", "Este condutor tem de ter enviado a carta de condução antes de poder ser validado."],
  ["Ce conducteur doit avoir au moins un véhicule enregistré avant de pouvoir être validé.", "This driver must have at least one registered vehicle before they can be validated.", "Este condutor tem de ter pelo menos um veículo registado antes de poder ser validado."],
  ["La carte grise du véhicule doit être envoyée avant de pouvoir valider ce conducteur.", "The vehicle registration document must be uploaded before this driver can be validated.", "O livrete do veículo tem de ser enviado antes de este condutor poder ser validado."],
];

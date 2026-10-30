// backend/src/i18n/texts/texts-dto.ts
// [30/10/2026] v1 — Textes traduits (notifications, e-mails, SMS, PDF) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const TEXTS_DTO: readonly TextRow[] = [
  ["Numéro de téléphone invalide (format international requis).", "Invalid phone number (international format required).", "Número de telemóvel inválido (formato internacional obrigatório)."],
  ["Le mot de passe doit contenir exactement 6 chiffres.", "The password must contain exactly 6 digits.", "A palavra-passe tem de ter exatamente 6 dígitos."],
  ["Vous devez accepter les conditions d’utilisation et la politique de confidentialité pour créer un compte.", "You must accept the terms of use and the privacy policy to create an account.", "Tem de aceitar os termos de utilização e a política de privacidade para criar uma conta."],
  ["Adresse e-mail invalide.", "Invalid email address.", "Endereço de e-mail inválido."],
  ["Langue non prise en charge.", "Language not supported.", "Idioma não suportado."],
  ["Le prix doit être un nombre entier.", "The price must be a whole number.", "O preço deve ser um número inteiro."],
  ["Le montant doit être un nombre entier positif.", "The amount must be a positive whole number.", "O montante deve ser um número inteiro positivo."],
  ["Le code PIN doit comporter 6 chiffres.", "The PIN must have 6 digits.", "O código PIN deve ter 6 dígitos."],
  ["Le code PIN comporte 6 chiffres.", "The PIN has 6 digits.", "O código PIN tem 6 dígitos."],
  ["L'adresse e-mail du destinataire n'est pas valide.", "The recipient's email address is not valid.", "O endereço de e-mail do destinatário não é válido."],
  ["Vous pouvez joindre 2 photos au plus.", "You can attach 2 photos at most.", "Pode anexar no máximo 2 fotografias."],
  ["La valeur déclarée doit être un montant en chiffres.", "The declared value must be an amount in digits.", "O valor declarado deve ser um montante em algarismos."],
  ["La recherche doit contenir au moins 3 caractères.", "The search must contain at least 3 characters.", "A pesquisa deve ter pelo menos 3 carateres."],
  ["Le mot de passe doit contenir au moins 10 caractères.", "The password must contain at least 10 characters.", "A palavra-passe deve ter pelo menos 10 carateres."],
  ["Le mot de passe est trop long (72 caractères au plus).", "The password is too long (72 characters at most).", "A palavra-passe é demasiado longa (72 carateres no máximo)."],
  ["Le mot de passe doit contenir au moins une lettre.", "The password must contain at least one letter.", "A palavra-passe deve conter pelo menos uma letra."],
  ["Le mot de passe doit contenir au moins un chiffre.", "The password must contain at least one digit.", "A palavra-passe deve conter pelo menos um dígito."],
];

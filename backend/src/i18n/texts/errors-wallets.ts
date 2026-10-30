// backend/src/i18n/texts/errors-wallets.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_WALLETS: readonly TextRow[] = [
  ["Numéro Mobile Money invalide : saisis ton numéro avec l'indicatif du pays (par exemple +224620000000).", "Invalid Mobile Money number: enter your number with the country code (for example +224620000000).", "Número Mobile Money inválido: introduza o seu número com o indicativo do país (por exemplo +224620000000)."],
  ["Le montant minimum d'un retrait est de {0}.", "The minimum withdrawal amount is {0}.", "O montante mínimo de um levantamento é {0}."],
  ["Plafond de retrait atteint : {0} par 24 heures. Il te reste {1} à retirer aujourd'hui.", "Withdrawal limit reached: {0} per 24 hours. You have {1} left to withdraw today.", "Limite de levantamento atingido: {0} por 24 horas. Ainda pode levantar {1} hoje."],
  ["Retrait introuvable.", "Withdrawal not found.", "Levantamento não encontrado."],
  ["Ce retrait est déjà en cours d'envoi ou clôturé : il ne peut plus être annulé.", "This withdrawal is already being sent or closed: it can no longer be cancelled.", "Este levantamento já está a ser enviado ou encerrado: já não pode ser cancelado."],
  ["Seul un retrait en attente de validation peut être validé.", "Only a withdrawal awaiting validation can be validated.", "Só um levantamento a aguardar validação pode ser validado."],
  ["Ce retrait n'a pas de numéro Mobile Money : refuse-le, le conducteur pourra réessayer avec un numéro.", "This withdrawal has no Mobile Money number: reject it, the driver can try again with a number.", "Este levantamento não tem número Mobile Money: recuse-o, o condutor poderá tentar novamente com um número."],
  ["Orange Money n'est pas encore branché : un envoi serait marqué payé sans qu'aucun argent ne parte. Passe le retrait en traitement, fais le virement toi-même, puis marque-le payé.", "Orange Money is not connected yet: a transfer would be marked as paid without any money being sent. Put the withdrawal into processing, make the transfer yourself, then mark it as paid.", "O Orange Money ainda não está ligado: um envio seria marcado como pago sem que nenhum dinheiro saísse. Passe o levantamento a processamento, faça a transferência você mesmo e marque-o como pago."],
  ["Ce retrait a déjà été pris en charge.", "This withdrawal has already been taken on.", "Este levantamento já foi assumido."],
  ["Ce retrait ne peut pas être marqué en traitement.", "This withdrawal cannot be marked as processing.", "Este levantamento não pode ser marcado como em processamento."],
  ["Ce retrait est déjà clôturé (payé, échoué ou annulé).", "This withdrawal is already closed (paid, failed or cancelled).", "Este levantamento já está encerrado (pago, falhado ou cancelado)."],
  ["Ton code PIN n'est pas encore défini : définis-le d'abord pour pouvoir confirmer un retrait.", "Your PIN has not been set yet: set it first so you can confirm a withdrawal.", "O seu código PIN ainda não está definido: defina-o primeiro para poder confirmar um levantamento."],
  ["Code PIN incorrect.", "Incorrect PIN.", "Código PIN incorreto."],
  ["Trop d'essais. Réessaie dans {0} minute{1}, ou utilise « Mot de passe oublié » à la connexion.", "Too many attempts. Try again in {0} minute{1}, or use “Forgotten password” at login.", "Demasiadas tentativas. Tente novamente dentro de {0} minuto{1}, ou utilize «Palavra-passe esquecida» no início de sessão."],
  ["Portefeuille introuvable.", "Wallet not found.", "Carteira não encontrada."],
  ["Libération concurrente des fonds, veuillez réessayer.", "Concurrent release of funds, please try again.", "Libertação simultânea dos fundos, tente novamente."],
  ["Reprise concurrente des fonds, veuillez réessayer.", "Concurrent recovery of funds, please try again.", "Recuperação simultânea dos fundos, tente novamente."],
  ["Ce débit rendrait le solde disponible négatif. Réduisez le montant, ou confirmez explicitement une dette (allowDebt).", "This debit would make the available balance negative. Reduce the amount, or explicitly confirm a debt (allowDebt).", "Este débito tornaria o saldo disponível negativo. Reduza o montante ou confirme explicitamente uma dívida (allowDebt)."],
  ["Solde insuffisant pour ce retrait.", "Insufficient balance for this withdrawal.", "Saldo insuficiente para este levantamento."],
  ["Le solde en attente ne couvre pas ce retrait — vérification manuelle nécessaire.", "The pending balance does not cover this withdrawal — manual check required.", "O saldo pendente não cobre este levantamento — é necessária verificação manual."],
];

// mobile/src/components/auth/signupSteps.ts
// [11/10/2026] v1 — Les 7 étapes de la création de compte, dans l'ordre, pour le repère « Étape x sur 7 » commun à tous les écrans.
// 1 Nom · 2 Prénom · 3 Pays · 4 Téléphone · 5 Code SMS · 6 E-mail (facultatif, avec son code) · 7 Mot de passe.
export const SIGNUP_STEPS = 7;

export const SIGNUP_STEP = {
  lastName: 1,
  firstName: 2,
  country: 3,
  phone: 4,
  phoneCode: 5,
  email: 6,
  password: 7,
} as const;

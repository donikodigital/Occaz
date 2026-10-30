// backend/src/integrations/sms/policy-sms.provider.spec.ts
// Politique SMS : seuls l'inscription, le mot de passe oublié, le destinataire d'un colis et le NOUVEAU numéro d'un changement de numéro envoient un SMS.
import { PolicySmsProvider } from './policy-sms.provider';
import { DEFAULT_ALLOWED_SMS_PURPOSES, SmsPurpose, SmsPurposeNotAllowedError, isSmsPurposeAllowed } from './sms-purpose';

const make = (env: NodeJS.ProcessEnv = {}) => {
  const inner = { send: jest.fn().mockResolvedValue(undefined) };
  return { inner, policy: new PolicySmsProvider(inner, env) };
};

describe('PolicySmsProvider', () => {
  it.each([SmsPurpose.SIGNUP, SmsPurpose.PASSWORD_RESET, SmsPurpose.PARCEL_RECIPIENT, SmsPurpose.PHONE_CHANGE, SmsPurpose.DEVICE_VERIFICATION])('%s : le SMS part', async (purpose) => {
    const { inner, policy } = make();
    await policy.send('+224620000001', 'Code 123456', purpose);
    expect(inner.send).toHaveBeenCalledWith('+224620000001', 'Code 123456', purpose);
  });

  it.each([SmsPurpose.PHONE_CHANGE_ALERT, SmsPurpose.LOGIN, SmsPurpose.HANDOVER, SmsPurpose.NOTIFICATION, SmsPurpose.SOS])('%s : refusé par défaut', async (purpose) => {
    const { inner, policy } = make();
    await expect(policy.send('+224620000001', 'x', purpose)).rejects.toBeInstanceOf(SmsPurposeNotAllowedError);
    expect(inner.send).not.toHaveBeenCalled();
  });

  it('sans motif : refusé (rien ne part par oubli)', async () => {
    const { inner, policy } = make();
    await expect(policy.send('+224620000001', 'x')).rejects.toBeInstanceOf(SmsPurposeNotAllowedError);
    expect(inner.send).not.toHaveBeenCalled();
  });

  it('SMS_EXTRA_PURPOSES réactive un motif sans redéployer, ignore les valeurs inconnues', async () => {
    const { inner, policy } = make({ SMS_EXTRA_PURPOSES: ' sos , inconnu ' });
    await policy.send('+224620000001', 'SOS', SmsPurpose.SOS);
    expect(inner.send).toHaveBeenCalledTimes(1);
    await expect(policy.send('+224620000001', 'x', SmsPurpose.NOTIFICATION)).rejects.toBeInstanceOf(SmsPurposeNotAllowedError);
  });

  it('la liste par défaut contient exactement cinq motifs', () => {
    expect([...DEFAULT_ALLOWED_SMS_PURPOSES].sort()).toEqual(['DEVICE_VERIFICATION', 'PARCEL_RECIPIENT', 'PASSWORD_RESET', 'PHONE_CHANGE', 'SIGNUP']);
    expect(isSmsPurposeAllowed(undefined, {})).toBe(false);
  });
});

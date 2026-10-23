// backend/src/locations/locations.controller.spec.ts
// Confidentialité des adresses : les routes qui exposent TOUTES les adresses (proximité, lecture par identifiant) sont réservées au
// personnel ; les routes utilisées par l'application (création, adresses de l'utilisateur, détection de ville) restent ouvertes.
import 'reflect-metadata';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { LocationsController } from './locations.controller';

const required = (method: keyof LocationsController) =>
  Reflect.getMetadata(PERMISSIONS_KEY, LocationsController.prototype[method]) as string[] | undefined;

describe('LocationsController — confidentialité des adresses', () => {
  it.each(['findNearby', 'findOne', 'update', 'remove'] as const)('%s exige la permission geography.manage', (method) => {
    expect(required(method)).toEqual([PERMISSIONS.GEOGRAPHY_MANAGE]);
  });

  it.each(['create', 'findSaved', 'resolveCity', 'markUsed'] as const)('%s reste accessible à tout compte connecté', (method) => {
    expect(required(method)).toBeUndefined();
  });
});

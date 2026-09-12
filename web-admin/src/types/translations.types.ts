// web-admin/src/types/translations.types.ts
export interface Translation {
  entityType: string;
  entityId: string;
  locale: string;
  field: string;
  value: string;
}

export interface UpsertTranslationPayload {
  entityType: string;
  entityId: string;
  locale: string;
  field: string;
  value: string;
}

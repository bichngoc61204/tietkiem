// Inject only a rules-unit-testing context, never a production Firebase instance.
export let db: any;
export const auth = {};
export function useTestDatabase(value: any) { db = value; }

export type OperationType = 'create' | 'update' | 'delete' | 'list' | 'get';

export function handleSupabaseError(error: any, operation: OperationType, table: string): never {
  const message = error?.message || String(error);
  const details = error?.details || '';
  const hint = error?.hint || '';
  console.error(`[Supabase ${operation.toUpperCase()} error on "${table}"]`, error);
  throw new Error(`Failed to ${operation} ${table}: ${message} ${details} ${hint}`);
}

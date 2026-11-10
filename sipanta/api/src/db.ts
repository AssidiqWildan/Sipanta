import pg from 'pg';

pg.types.setTypeParser(1082, v => v);                 // date -> 'YYYY-MM-DD'
pg.types.setTypeParser(1700, v => parseFloat(v));     // numeric
pg.types.setTypeParser(20, v => parseInt(v, 10));     // bigint

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://sipanta:sipanta@localhost:5432/sipanta' });

export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query(text, params as any[])).rows as T[];
}
export async function q1<T = any>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await q<T>(text, params))[0];
}

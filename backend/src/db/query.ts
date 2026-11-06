/** Tiny parameterised-SQL builder: every value goes through $n placeholders — never string-concatenated into SQL. */
export class Query {
  readonly params: unknown[] = [];
  private clauses: string[] = [];
 
  /** Registers a value and returns its placeholder, e.g. q.p('x') → '$3'. */
  p(value: unknown): string { this.params.push(value); return `$${this.params.length}`; }
 
  /** where('status = ? AND type = ANY(?)', status, types) — each `?` becomes the next $n. */
  where(sql: string, ...values: unknown[]): this {
    let i = 0;
    this.clauses.push(`(${sql.replace(/\?/g, () => this.p(values[i++]))})`);
    return this;
  }
  /** Adds a clause that has no values (or that already used q.p()). */
  raw(sql: string): this { this.clauses.push(`(${sql})`); return this; }
  get hasClauses() { return this.clauses.length > 0; }
  get whereSql(): string { return this.clauses.length ? `WHERE ${this.clauses.join(' AND ')}` : ''; }
}
 
/** ILIKE pattern with LIKE wildcards in the user's text escaped. */
export const likePattern = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
 
/** Adds "(col1 ILIKE $n OR col2 ILIKE $n …)" for a search box. */
export function addSearch(q: Query, search: string | undefined, columns: string[]) {
  if (!search?.trim()) return;
  const ph = q.p(likePattern(search.trim()));
  q.raw(columns.map((c) => `${c} ILIKE ${ph}`).join(' OR '));
}
 
export interface SortSpec { fields: Record<string, string>; default: string; order?: 'asc' | 'desc' }
/** Maps a public sort field to a whitelisted SQL expression — user input never reaches ORDER BY directly. */
export function orderBy(spec: SortSpec, sort?: string, order?: 'asc' | 'desc', tiebreaker = 'id') {
  const key = sort && spec.fields[sort] ? sort : spec.default;
  const dir = (sort && spec.fields[sort] ? order : undefined) ?? (key === spec.default ? spec.order : undefined) ?? 'asc';
  return `ORDER BY ${spec.fields[key]} ${dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, ${tiebreaker} ASC`;
}
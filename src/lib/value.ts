export type Row = Record<string, unknown> & {
  id: string;
  slug: string;
  sheet: string;
};

/** Resolve a column key against the row, its detail record, or its flags.
 *  Shared by the table, the record editor and the CSV export. */
export function value(row: Row, key: string): unknown {
  if (key.startsWith("f.")) {
    return (row.flags as Record<string, string> | null)?.[key.slice(2)];
  }
  if (key.startsWith("d.")) {
    const detail =
      row.memecoin ?? row.nft ?? row.collection ?? row.provfi ?? null;
    return (detail as Record<string, unknown> | null)?.[key.slice(2)];
  }
  return row[key];
}

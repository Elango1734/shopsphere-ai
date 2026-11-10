export interface Migration {
  /** Monotonically increasing, sortable id, e.g. "0001-normalize-user-emails". */
  id: string;
  description: string;
  up(): Promise<void>;
}

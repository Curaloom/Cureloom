// better-sqlite3's small synchronous API, on top of sql.js, so the server's
// Service runs unchanged in the browser.
import type { Database, SqlValue } from 'sql.js';
import type { DB, Stmt } from '../../server/schema';

function params(args: unknown[]): SqlValue[] {
  return args.map((a) => (a === undefined ? null : typeof a === 'boolean' ? (a ? 1 : 0) : (a as SqlValue)));
}

export function wrapSqlJs(db: Database): DB {
  let depth = 0;
  return {
    exec: (sql) => db.exec(sql),
    prepare(sql): Stmt {
      return {
        get(...args) {
          const st = db.prepare(sql);
          try {
            st.bind(params(args));
            return st.step() ? st.getAsObject() : undefined;
          } finally {
            st.free();
          }
        },
        all(...args) {
          const st = db.prepare(sql);
          const out: unknown[] = [];
          try {
            st.bind(params(args));
            while (st.step()) out.push(st.getAsObject());
          } finally {
            st.free();
          }
          return out;
        },
        run(...args) {
          db.run(sql, params(args));
          const r = db.exec('SELECT last_insert_rowid(), changes()');
          return { lastInsertRowid: Number(r[0].values[0][0]), changes: Number(r[0].values[0][1]) };
        },
      };
    },
    transaction(fn) {
      return ((...a: unknown[]) => {
        const sp = `sp${depth++}`;
        db.run(`SAVEPOINT ${sp}`);
        try {
          const r = fn(...a);
          db.run(`RELEASE ${sp}`);
          return r;
        } catch (e) {
          db.run(`ROLLBACK TO ${sp}`);
          db.run(`RELEASE ${sp}`);
          throw e;
        } finally {
          depth--;
        }
      }) as typeof fn;
    },
  };
}

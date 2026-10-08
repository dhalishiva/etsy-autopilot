/**
 * Tiny Excel-formula evaluator used for previews and listing mockups, so
 * images show real numbers computed from the template's sample rows.
 * It understands the template placeholder syntax directly:
 *   [key]          same-row value
 *   {{Sheet.key}}  column values of a table (sample rows)
 *   {label}        breakdown label
 *   C5             previous summary metric (row 4 = first metric)
 * Supported: + - * / & comparisons, array constants, and the functions the
 * templates use. Anything else throws, and callers fall back to a blank.
 */

export type Scalar = number | string | boolean | null;
export type Value = Scalar | Scalar[];

export interface EvalContext {
  row?: Record<string, Scalar>;
  column?: (sheet: string, key: string) => Scalar[];
  vars?: Record<string, Scalar>;
  cells?: Record<string, Scalar>;
  today?: number;
}

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'id'; v: string }
  | { t: 'cell'; v: string }
  | { t: 'field'; v: string }
  | { t: 'range'; sheet: string; key: string }
  | { t: 'var'; v: string }
  | { t: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === ' ') {
      i++;
      continue;
    }
    if (src.startsWith('{{', i)) {
      const end = src.indexOf('}}', i);
      const [sheet, key] = src.slice(i + 2, end).split('.') as [string, string];
      out.push({ t: 'range', sheet, key });
      i = end + 2;
      continue;
    }
    if (c === '{') {
      const m = /^\{([A-Za-z_][A-Za-z0-9_]*)\}/.exec(src.slice(i));
      if (m) {
        out.push({ t: 'var', v: m[1]! });
        i += m[0].length;
        continue;
      }
      out.push({ t: 'op', v: '{' });
      i++;
      continue;
    }
    if (c === '[') {
      const end = src.indexOf(']', i);
      out.push({ t: 'field', v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let s = '';
      while (j < src.length) {
        if (src[j] === '"' && src[j + 1] === '"') {
          s += '"';
          j += 2;
        } else if (src[j] === '"') break;
        else s += src[j++];
      }
      out.push({ t: 'str', v: s });
      i = j + 1;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const cell = /^\$?([A-Z]{1,2})\$?(\d+)(?![A-Za-z0-9_(])/.exec(src.slice(i));
    if (cell) {
      out.push({ t: 'cell', v: `${cell[1]}${cell[2]}` });
      i += cell[0].length;
      continue;
    }
    const id = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i));
    if (id) {
      out.push({ t: 'id', v: id[0].toUpperCase() });
      i += id[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '<>' || two === '<=' || two === '>=') {
      out.push({ t: 'op', v: two });
      i += 2;
      continue;
    }
    if ('+-*/&=<>(),}'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    throw new Error(`Unexpected "${c}" in formula`);
  }
  return out;
}

type Node =
  | { k: 'lit'; v: Value }
  | { k: 'field'; v: string }
  | { k: 'range'; sheet: string; key: string }
  | { k: 'var'; v: string }
  | { k: 'cell'; v: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; name: string; args: Node[] };

function parse(tokens: Tok[]): Node {
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new Error(`Expected ${v}`);
    p++;
  };

  const levels: string[][] = [['=', '<>', '<', '>', '<=', '>='], ['&'], ['+', '-'], ['*', '/']];
  function binary(level: number): Node {
    if (level === levels.length) return unary();
    let left = binary(level + 1);
    while (peek()?.t === 'op' && levels[level]!.includes((peek() as { v: string }).v)) {
      const op = (tokens[p++] as { v: string }).v;
      left = { k: 'bin', op, a: left, b: binary(level + 1) };
    }
    return left;
  }
  function unary(): Node {
    if (isOp('-')) {
      p++;
      return { k: 'neg', a: unary() };
    }
    if (isOp('+')) {
      p++;
      return unary();
    }
    return primary();
  }
  function primary(): Node {
    const tok = tokens[p++];
    if (!tok) throw new Error('Unexpected end of formula');
    switch (tok.t) {
      case 'num':
      case 'str':
        return { k: 'lit', v: tok.v };
      case 'field':
        return { k: 'field', v: tok.v };
      case 'range':
        return { k: 'range', sheet: tok.sheet, key: tok.key };
      case 'var':
        return { k: 'var', v: tok.v };
      case 'cell':
        return { k: 'cell', v: tok.v };
      case 'id': {
        if (tok.v === 'TRUE' || tok.v === 'FALSE') return { k: 'lit', v: tok.v === 'TRUE' };
        expect('(');
        const args: Node[] = [];
        if (!isOp(')')) {
          args.push(binary(0));
          while (isOp(',')) {
            p++;
            args.push(binary(0));
          }
        }
        expect(')');
        return { k: 'call', name: tok.v, args };
      }
      case 'op':
        if (tok.v === '(') {
          const n = binary(0);
          expect(')');
          return n;
        }
        if (tok.v === '{') {
          const items: Scalar[] = [];
          while (!isOp('}')) {
            const t = tokens[p++];
            if (t?.t === 'str' || t?.t === 'num') items.push(t.v);
            if (isOp(',')) p++;
          }
          p++;
          return { k: 'lit', v: items };
        }
    }
    throw new Error('Bad formula');
  }

  const node = binary(0);
  if (p !== tokens.length) throw new Error('Trailing tokens in formula');
  return node;
}

/* ------------------------------ Evaluation ------------------------------ */

const num = (v: Scalar): number => {
  if (v === null || v === '') return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error('#VALUE!');
  return n;
};
const str = (v: Scalar) => (v === null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v));
const flat = (vs: Value[]): Scalar[] => vs.flatMap((v) => (Array.isArray(v) ? v : [v]));

function compare(a: Scalar, b: Scalar, op: string): boolean {
  let x: number | string;
  let y: number | string;
  if ((typeof a === 'number' || a === null) && (typeof b === 'number' || b === null) && !(a === null && b === null)) {
    x = num(a);
    y = num(b);
  } else {
    x = str(a).toLowerCase();
    y = str(b).toLowerCase();
  }
  switch (op) {
    case '=':
      return x === y;
    case '<>':
      return x !== y;
    case '<':
      return x < y;
    case '>':
      return x > y;
    case '<=':
      return x <= y;
    default:
      return x >= y;
  }
}

function matches(v: Scalar, criterion: Scalar): boolean {
  if (typeof criterion === 'string') {
    const m = /^(<>|<=|>=|=|<|>)(.*)$/.exec(criterion);
    if (m) {
      const rhs = m[2] === '' ? null : Number.isNaN(Number(m[2])) ? m[2]! : Number(m[2]);
      if (m[1] === '<>' && rhs === null) return v !== null && v !== '';
      if (m[1] === '<>') return !compare(v, rhs, '=');
      return compare(v, rhs, m[1]!);
    }
    return v !== null && str(v).toLowerCase() === criterion.toLowerCase();
  }
  return v !== null && compare(v, criterion, '=');
}

function broadcast(a: Value, b: Value, f: (x: Scalar, y: Scalar) => Scalar): Value {
  if (Array.isArray(a) || Array.isArray(b)) {
    const n = Math.max(Array.isArray(a) ? a.length : 1, Array.isArray(b) ? b.length : 1);
    return Array.from({ length: n }, (_, i) => f(Array.isArray(a) ? a[i] ?? null : a, Array.isArray(b) ? b[i] ?? null : b));
  }
  return f(a, b);
}

const map1 = (a: Value, f: (x: Scalar) => Scalar): Value => (Array.isArray(a) ? a.map(f) : f(a));

/** Excel serial date (days since 1899-12-30) → JS month (1-12). */
function serialMonth(s: number): number {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(s) * 86400000);
  return d.getUTCMonth() + 1;
}

export function toSerial(iso: string): number {
  const t = Date.parse(iso + 'T00:00:00Z');
  return Math.round((t - Date.UTC(1899, 11, 30)) / 86400000);
}

function evalNode(n: Node, ctx: EvalContext): Value {
  switch (n.k) {
    case 'lit':
      return n.v;
    case 'field':
      if (!ctx.row || !(n.v in ctx.row)) return null;
      return ctx.row[n.v] ?? null;
    case 'range':
      if (!ctx.column) throw new Error('No ranges here');
      return ctx.column(n.sheet, n.key);
    case 'var':
      return ctx.vars?.[n.v] ?? null;
    case 'cell':
      return ctx.cells?.[n.v] ?? null;
    case 'neg':
      return map1(evalNode(n.a, ctx), (x) => -num(x));
    case 'bin': {
      const a = evalNode(n.a, ctx);
      const b = evalNode(n.b, ctx);
      return broadcast(a, b, (x, y) => {
        switch (n.op) {
          case '+':
            return num(x) + num(y);
          case '-':
            return num(x) - num(y);
          case '*':
            return num(x) * num(y);
          case '/':
            if (num(y) === 0) throw new Error('#DIV/0!');
            return num(x) / num(y);
          case '&':
            return str(x) + str(y);
          default:
            return compare(x, y, n.op);
        }
      });
    }
    case 'call':
      return call(n.name, n.args, ctx);
  }
}

function call(name: string, args: Node[], ctx: EvalContext): Value {
  const ev = (i: number) => evalNode(args[i]!, ctx);
  const arr = (i: number): Scalar[] => {
    const v = ev(i);
    return Array.isArray(v) ? v : [v];
  };
  switch (name) {
    case 'SUM':
      return flat(args.map((_, i) => ev(i))).reduce<number>((s, v) => s + (typeof v === 'number' ? v : 0), 0);
    case 'AVERAGE': {
      const nums = flat(args.map((_, i) => ev(i))).filter((v): v is number => typeof v === 'number');
      if (!nums.length) throw new Error('#DIV/0!');
      return nums.reduce((s, v) => s + v, 0) / nums.length;
    }
    case 'MAX':
    case 'MIN': {
      const nums = flat(args.map((_, i) => ev(i))).map((v) => (typeof v === 'number' ? v : num(v)));
      if (!nums.length) return 0;
      return name === 'MAX' ? Math.max(...nums) : Math.min(...nums);
    }
    case 'COUNTA':
      return flat(args.map((_, i) => ev(i))).filter((v) => v !== null && v !== '').length;
    case 'COUNTIF': {
      const crit = ev(1) as Scalar;
      return arr(0).filter((v) => matches(v, crit)).length;
    }
    case 'COUNTIFS': {
      const pairs: { r: Scalar[]; c: Scalar }[] = [];
      for (let i = 0; i < args.length; i += 2) pairs.push({ r: arr(i), c: ev(i + 1) as Scalar });
      const n = pairs[0]!.r.length;
      let count = 0;
      for (let i = 0; i < n; i++) if (pairs.every((p) => matches(p.r[i] ?? null, p.c))) count++;
      return count;
    }
    case 'SUMIF': {
      const range = arr(0);
      const crit = ev(1) as Scalar;
      const sums = args[2] ? arr(2) : range;
      return range.reduce<number>((s, v, i) => s + (matches(v, crit) && typeof sums[i] === 'number' ? (sums[i] as number) : 0), 0);
    }
    case 'SUMIFS': {
      const sums = arr(0);
      const pairs: { r: Scalar[]; c: Scalar }[] = [];
      for (let i = 1; i < args.length; i += 2) pairs.push({ r: arr(i), c: ev(i + 1) as Scalar });
      return sums.reduce<number>(
        (s, v, i) => s + (typeof v === 'number' && pairs.every((p) => matches(p.r[i] ?? null, p.c)) ? v : 0),
        0,
      );
    }
    case 'SUMPRODUCT': {
      const lists = args.map((_, i) => arr(i));
      const n = Math.max(...lists.map((l) => l.length));
      let s = 0;
      for (let i = 0; i < n; i++) s += lists.reduce((prod, l) => prod * num(l[i] ?? null), 1);
      return s;
    }
    case 'IF': {
      const c = ev(0);
      if (Array.isArray(c)) throw new Error('Array IF not supported');
      const truthy = typeof c === 'boolean' ? c : num(c) !== 0;
      return truthy ? (args[1] ? ev(1) : true) : args[2] ? ev(2) : false;
    }
    case 'IFERROR':
      try {
        return ev(0);
      } catch {
        return ev(1);
      }
    case 'AND':
      return flat(args.map((_, i) => ev(i))).every((v) => (typeof v === 'boolean' ? v : num(v) !== 0));
    case 'OR':
      return flat(args.map((_, i) => ev(i))).some((v) => (typeof v === 'boolean' ? v : num(v) !== 0));
    case 'N':
      return map1(ev(0), (v) => (typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : 0));
    case 'ISNUMBER':
      return map1(ev(0), (v) => typeof v === 'number');
    case 'MONTH':
      return map1(ev(0), (v) => serialMonth(num(v)));
    case 'TODAY':
      return ctx.today ?? toSerial(new Date().toISOString().slice(0, 10));
    case 'MATCH': {
      const needle = ev(0) as Scalar;
      const idx = arr(1).findIndex((v) => compare(v, needle, '='));
      if (idx < 0) throw new Error('#N/A');
      return idx + 1;
    }
    default:
      throw new Error(`Function ${name} not supported in previews`);
  }
}

const cache = new Map<string, Node>();

export function evaluate(formula: string, ctx: EvalContext): Value {
  const src = formula.startsWith('=') ? formula.slice(1) : formula;
  let node = cache.get(src);
  if (!node) {
    node = parse(tokenize(src));
    cache.set(src, node);
  }
  return evalNode(node, ctx);
}

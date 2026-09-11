type Value = string | number | boolean | null | undefined;
type Row = Record<string, unknown>;

function url() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured. Add your Turso/libSQL SQLite URL in Vercel.");
  return value.replace(/^libsql:/, "https:").replace(/^ws:/, "https:").replace(/\/$/, "");
}
function encode(value: Value) {
  if (value === null || value === undefined) return { type: "null" };
  if (typeof value === "boolean") return { type: "integer", value: value ? "1" : "0" };
  if (typeof value === "number") return Number.isInteger(value) ? { type: "integer", value: String(value) } : { type: "float", value };
  return { type: "text", value: String(value) };
}
function decode(value: { type: string; value?: string | number }) {
  if (value.type === "null") return null;
  if (value.type === "integer" || value.type === "float") return Number(value.value);
  return value.value ?? "";
}
async function execute(sql: string, args: Value[] = []) {
  const response = await fetch(url() + "/v2/pipeline", { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.DATABASE_AUTH_TOKEN ? { Authorization: "Bearer " + process.env.DATABASE_AUTH_TOKEN } : {}) }, body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql, args: args.map(encode) } }] }) });
  if (!response.ok) throw new Error("SQLite database request failed.");
  const payload = await response.json() as any;
  const item = payload.results?.[0];
  if (!item || item.type !== "ok") throw new Error(item?.error?.message || "SQLite database request failed.");
  const result = item.response?.result;
  const columns = result?.cols?.map((column: { name: string }) => column.name) ?? [];
  const records = (result?.rows ?? []).map((values: Array<{ type: string; value?: string | number }>) => Object.fromEntries(values.map((value, index) => [columns[index], decode(value)]))) as Row[];
  return { records, changes: result?.affected_row_count ?? 0 };
}
class Statement {
  constructor(private sql: string, private args: Value[]) {}
  async run() { const result = await execute(this.sql, this.args); return { meta: { changes: result.changes } }; }
  async first<T = Row>() { return (await execute(this.sql, this.args)).records[0] as T | null; }
  async all<T = Row>() { return { results: (await execute(this.sql, this.args)).records as T[] }; }
}
export const settings = () => process.env as Record<string, string | undefined>;
export const database = () => ({ batch: async (statements: Statement[]) => Promise.all(statements.map(statement => statement.run())) });
export const query = (sql: string, ...args: Value[]) => new Statement(sql, args);
export async function rows<T = Row>(sql: string, ...args: Value[]) { return (await query(sql, ...args).all<T>()).results; }
export const one = <T = Row>(sql: string, ...args: Value[]) => query(sql, ...args).first<T>();
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export const secret = (key: string) => process.env[key] || "";
export const publicUser = (user: Record<string, unknown>) => { const { password, ...safe } = user; void password; return safe; };
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function assert(condition: unknown, message: string, status = 400): asserts condition { if (!condition) throw new HttpError(status, message); }
export function token() { const bytes = crypto.getRandomValues(new Uint8Array(32)); return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join(""); }
export async function hash(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), item => item.toString(16).padStart(2, "0")).join(""); }
export async function passwordHash(password: string, salt = token()) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]); const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", iterations: 100000, salt: new TextEncoder().encode(salt) }, key, 256); return salt + ":" + Array.from(new Uint8Array(bits), item => item.toString(16).padStart(2, "0")).join(""); }
export function equal(left: string, right: string) { let difference = left.length ^ right.length; for (let index = 0; index < Math.max(left.length, right.length); index++) difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0); return difference === 0; }
export function cookie(request: Request, name = "nexora_session") { return request.headers.get("cookie")?.split(";").map(item => item.trim()).find(item => item.startsWith(name + "="))?.slice(name.length + 1) || ""; }
export function sessionCookie(request: Request, value: string, maxAge = 2592000) { const requestUrl = new URL(request.url); const domain = requestUrl.hostname.endsWith(".grapaxels.in") ? "; Domain=.grapaxels.in" : ""; return "nexora_session=" + value + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + maxAge + (requestUrl.protocol === "https:" ? "; Secure" : "") + domain; }
export async function session(request: Request) { const value = cookie(request); if (!value) return null; const user = await one<Record<string, any>>("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?", await hash(value), Date.now()); if (!user || user.suspended) return null; return { ...publicUser(user), isAdmin: !!user.verified && user.email === secret("ADMIN_EMAIL") }; }
export async function login(request: Request, userId: string) { const value = token(); await query("INSERT INTO sessions (hash,user_id,expires) VALUES (?,?,?)", await hash(value), userId, Date.now() + 2592000000).run(); return sessionCookie(request, value); }
export async function rate(request: Request, action: string, limit = 20) { const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local"; const key = await hash(ip + ":" + action); const expires = Date.now() + 900000; await query("INSERT INTO rate_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END", key, expires, Date.now(), Date.now()).run(); const value = await one<{ count: number }>("SELECT count FROM rate_limits WHERE key=?", key); assert(Number(value?.count) <= limit, "Too many attempts. Try again in 15 minutes.", 429); }
export function match(job: Record<string, unknown>, user: Record<string, unknown>) { const skills = String(user.skills || "").toLowerCase().split(",").map(item => item.trim()).filter(Boolean); const wanted = String(job.skills).toLowerCase().split(",").map(item => item.trim()).filter(Boolean); const reasons: string[] = []; let score = 0; const overlap = wanted.filter(item => skills.includes(item)).length; if (overlap) { score += Math.round(40 * overlap / Math.max(1, wanted.length)); reasons.push("Skills aligned"); } if (job.city === "Remote" || String(job.city).toLowerCase() === String(user.city).toLowerCase()) { score += 20; reasons.push("Location fits"); } if (Number(user.experience) >= Number(job.experience)) { score += 10; reasons.push("Experience fits"); } if (Number(job.budget) / 100 / Number(job.duration) >= Number(user.expected_pay)) { score += 10; reasons.push("Meets expected pay"); } return { score, reasons }; }

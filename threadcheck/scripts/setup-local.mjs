import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes, randomInt } from "node:crypto";
import { parse } from "dotenv";

const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
const filename = "server/.env";
let contents = readFileSync(
  existsSync(filename) ? filename : "server/.env.example",
  "utf8",
);
const current = parse(contents);
const values = {
  DATABASE_URL: status.DB_URL,
  VAULT_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  PAIRING_CODE: String(randomInt(100000, 1000000)),
  VAULT_TIMEZONE: "America/Toronto",
};
for (const [name, value] of Object.entries(values)) {
  if (current[name]) continue;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  contents = pattern.test(contents)
    ? contents.replace(pattern, `${name}=${value}`)
    : `${contents}\n${name}=${value}\n`;
}
writeFileSync(filename, contents, { mode: 0o600 });
console.log(
  "Local Supabase URL and vault configuration saved in server/.env. Existing keys preserved. Add BACKBOARD_API_KEY to enable outfit verification.",
);

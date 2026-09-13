/**
 * Добавляет "use client" в клиентские модули (фаза Ф1).
 *
 * Next.js требует директиву в точке входа клиентского графа. Простейшая
 * надёжная стратегия миграции 1:1: пометить все модули, которые используют
 * React-хуки/JSX (components, pages, store, hooks). Лишняя директива в
 * модуле, уже импортированном из клиента, безвредна.
 *
 * Запуск: node scripts/add-use-client.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function walk(dir) {
  const out = [];
  for (const ent of readdirSync(dir)) {
    const p = join(dir, ent);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const targets = [
  join(ROOT, "src", "components"),
  join(ROOT, "src", "pages"),
  join(ROOT, "src", "store"),
  join(ROOT, "src", "hooks"),
];

let n = 0;
for (const dir of targets) {
  for (const f of walk(dir)) {
    if (!/\.(tsx|ts)$/.test(f)) continue;
    let src = readFileSync(f, "utf8");
    if (src.startsWith('"use client"') || src.startsWith("'use client'")) continue;
    // .ts-хуки без React-импортов тоже пометим — безопасно и единообразно.
    src = `"use client";\n\n` + src;
    writeFileSync(f, src, "utf8");
    n++;
    console.log(`+ ${relative(ROOT, f)}`);
  }
}
console.log(`\nПомечено: ${n}`);

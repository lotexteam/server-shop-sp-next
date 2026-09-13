/**
 * Кодмод миграции react-router-dom → next/link + next/navigation
 * (фаза Ф1 плана docs/MIGRATION-PLAN.md).
 *
 * Запуск: node scripts/codemod-router.mjs
 * Скрипт идемпотентен: файлы без "react-router-dom" не трогаются.
 *
 * Автоматика:
 *  - импорты react-router-dom → next/link (Link) / next/navigation (остальное);
 *  - <Link to= / <RouterLink to= → href=;
 *  - const navigate = useNavigate() → const router = useRouter();
 *    navigate(x, { replace: true }) → router.replace(x); navigate(x) → router.push(x);
 *  - const location = useLocation() → const pathname = usePathname()
 *    + location.pathname → pathname;
 *  - const [searchParams] = useSearchParams() → const searchParams = useSearchParams();
 *  - 'use client' в components/pages/store/hooks.
 *
 * Ручная доводка после кодмода (список печатается):
 *  - <Navigate> (ConfiguratorPage) — заменить на router.replace в useEffect;
 *  - setSearchParams (BlogPage, CatalogPage) — в Next нет деструктуризации
 *    [params, setParams]; заменяется на router.replace(pathname?qs).
 */
import { readdirSync, readFileSync, writeFileSync, statSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(ROOT, "src");

function walk(dir) {
  const out = [];
  for (const ent of readdirSync(dir)) {
    const p = join(dir, ent);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(ent)) out.push(p);
  }
  return out;
}

const manualFix = [];

function processFile(path) {
  let src = readFileSync(path, "utf8");
  if (!src.includes("react-router-dom")) return false;

  const rel = relative(ROOT, path);
  const importRe = /import\s*\{([^}]*)\}\s*from\s*"react-router-dom";?/;
  const m = src.match(importRe);
  if (!m) {
    manualFix.push(`${rel}: react-router-dom без типового import — вручную`);
    return false;
  }

  const symbols = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const mm = s.match(/^(\w+)\s+as\s+(\w+)$/);
      return mm ? { imported: mm[1], local: mm[2] } : { imported: s, local: s };
    });

  const linkSyms = symbols.filter((s) => s.imported === "Link");
  const navSyms = symbols.filter(
    (s) => ["useNavigate", "useLocation", "useParams", "useSearchParams"].includes(s.imported),
  );
  const unsupported = symbols.filter(
    (s) => !["Link", "useNavigate", "useLocation", "useParams", "useSearchParams"].includes(s.imported),
  );
  for (const s of unsupported) {
    manualFix.push(`${rel}: символ ${s.imported} — вручную`);
  }

  // ── Текстовые замены (до замены импорта, чтобы использовать старые имена) ──
  let next = src;

  // <Link to= / <RouterLink to= → href=  (переносы строк внутри тега учтены)
  next = next.replace(/(<(?:Link|RouterLink)\b[^>]*?)\s\nto=/gs, "$1 href=");
  next = next.replace(/(<(?:Link|RouterLink)\b[^>]*?)\bto=/g, "$1 href=");

  // navigate → router
  if (symbols.some((s) => s.imported === "useNavigate")) {
    next = next.replace(/const navigate = useNavigate\(\);/g, "const router = useRouter();");
    // navigate(x, { replace: true }) — в т.ч. многострочно
    next = next.replace(/navigate\(([^()]*?),\s*\{\s*replace:\s*true\s*,?\s*\}\)/gs, "router.replace($1)");
    // navigate(x, { ... прочие опции }) — не должно остаться; отметим
    const leftover = next.match(/navigate\([^)]*\{\s*[^}]*\}/);
    if (leftover) manualFix.push(`${rel}: navigate с опциями, кроме replace — вручную`);
    next = next.replace(/\bnavigate\(/g, "router.push(");
  }

  // useLocation → usePathname
  if (symbols.some((s) => s.imported === "useLocation")) {
    next = next.replace(/const location = useLocation\(\);/g, "const pathname = usePathname();");
    next = next.replace(/\blocation\.pathname\b/g, "pathname");
    if (next.includes("location.")) {
      manualFix.push(`${rel}: осталось location.* — вручную`);
    }
  }

  // useSearchParams: в Next нет деструктуризации
  if (symbols.some((s) => s.imported === "useSearchParams")) {
    if (/const \[searchParams, setSearchParams\] = useSearchParams\(\);/.test(next)) {
      next = next.replace(
        /const \[searchParams, setSearchParams\] = useSearchParams\(\);/,
        [
          "const searchParams = useSearchParams();",
          "const router = useRouter();",
          "const pathname = usePathname();",
          "// TODO(next): setSearchParams(next, { replace: true }) →",
          "// router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : \"\"}`)",
        ].join("\n  "),
      );
      manualFix.push(`${rel}: setSearchParams — заменить на router.replace (TODO в коде)`);
    }
    next = next.replace(/const \[(\w+)\] = useSearchParams\(\);/g, "const $1 = useSearchParams();");
  }

  // ── Новый блок импортов на месте старого ──
  const imports = [];
  if (linkSyms.length) {
    imports.push(
      `import ${linkSyms.map((s) => (s.local === s.imported ? s.imported : `${s.imported} as ${s.local}`)).join(", ")} from "next/link";`,
    );
  }
  if (navSyms.length) {
    const mapped = navSyms.map((s) => {
      const name =
        s.imported === "useNavigate" ? "useRouter" :
        s.imported === "useLocation" ? "usePathname" : s.imported;
      return name === s.local ? name : `${name} as ${s.local}`;
    });
    imports.push(`import { ${mapped.join(", ")} } from "next/navigation";`);
  }
  next = next.replace(importRe, imports.join("\n"));

  if (next !== src) {
    writeFileSync(path, next, "utf8");
    console.log(`✓ ${rel}`);
    return true;
  }
  return false;
}

let changed = 0;
for (const f of walk(SRC)) {
  if (processFile(f)) changed++;
}

// RootLayout заменён SiteChrome — удаляем
const rootLayout = join(SRC, "components", "layout", "RootLayout.tsx");
try {
  unlinkSync(rootLayout);
  console.log("✓ удалён src/components/layout/RootLayout.tsx (заменён SiteChrome.tsx)");
} catch {
  /* уже нет */
}

console.log(`\nОбработано файлов: ${changed}`);
if (manualFix.length) {
  console.log("\n── Ручная доводка ──");
  for (const x of [...new Set(manualFix)]) console.log(" •", x);
}

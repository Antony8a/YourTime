// Finds every text the app marks for translation: t('...'), tn(n, '...', '...') and
// msg('...'). Used by the translation test and as a tool:
//
//   node scripts/i18n-extract.cjs                 list every key
//   node scripts/i18n-extract.cjs --missing en    keys without a translation in "en"
//
// A text is the Spanish sentence itself, so the keys are readable in the catalogs.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SOURCES = ['apps/mobile/app', 'apps/mobile/src', 'packages/shared-utils/src'];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'i18n-catalogs') walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** The string literals an expression can evaluate to: branches of ?: and of ??, ||. */
function literalsOf(node, found) {
  if (!node) return;
  if (ts.isParenthesizedExpression(node)) return literalsOf(node.expression, found);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    found.push(node);
    return;
  }
  if (ts.isConditionalExpression(node)) {
    literalsOf(node.whenTrue, found);
    literalsOf(node.whenFalse, found);
    return;
  }
  if (ts.isBinaryExpression(node)) {
    const k = node.operatorToken.kind;
    if (k === ts.SyntaxKind.QuestionQuestionToken || k === ts.SyntaxKind.BarBarToken) {
      literalsOf(node.left, found);
      literalsOf(node.right, found);
    }
  }
}

/** Map of key -> list of "file:line" where it is used. */
function extractKeys() {
  const keys = new Map();
  for (const source of SOURCES) {
    for (const file of walk(path.join(ROOT, source))) {
      const text = fs.readFileSync(file, 'utf8');
      const sf = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      const add = (lit) => {
        if (lit.text.trim() === '') return; // a fallback like `?? ''`, not a text
        const line = sf.getLineAndCharacterOfPosition(lit.getStart(sf)).line + 1;
        if (!keys.has(lit.text)) keys.set(lit.text, []);
        keys.get(lit.text).push(`${rel}:${line}`);
      };
      const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          const name = node.expression.text;
          const found = [];
          if (name === 't' || name === 'msg') literalsOf(node.arguments[0], found);
          if (name === 'tn') {
            literalsOf(node.arguments[1], found);
            literalsOf(node.arguments[2], found);
          }
          found.forEach(add);
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
  }
  return keys;
}

/** The {placeholder} names a text uses, sorted. */
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

module.exports = { extractKeys, placeholders };

if (require.main === module) {
  const keys = extractKeys();
  const missingIdx = process.argv.indexOf('--missing');
  if (missingIdx === -1) {
    for (const [key, where] of [...keys].sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`${key}\t${where[0]}`);
    }
    console.error(`\n${keys.size} texts`);
  } else {
    const locale = process.argv[missingIdx + 1];
    const file = path.join(ROOT, 'packages/shared-utils/src/i18n', `${locale}.ts`);
    const body = fs.readFileSync(file, 'utf8');
    const have = new Set(
      [
        ...body.matchAll(
          /^\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)\s*:/gm
        ),
      ].map((m) => (m[1] ?? m[2] ?? m[3]).replace(/\\(['"`\\])/g, '$1'))
    );
    const missing = [...keys.keys()].filter((k) => !have.has(k)).sort((a, b) => a.localeCompare(b));
    console.log(JSON.stringify(missing, null, 2));
    console.error(`${missing.length} of ${keys.size} missing in ${locale}`);
  }
}

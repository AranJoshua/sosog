import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Checks every internal link and image in the built site actually resolves,
 * per sosog-tech-plan.md Section 4: "A link and image checker, run against
 * the built output, catches broken internal links and missing images
 * before they reach production." Run this after `astro build`, against
 * dist/. Doesn't touch external (http/https) links, mailto:, or
 * fragment-only (#) hrefs, those aren't this script's job.
 */

const DIST_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve('dist');

interface Reference {
  file: string; // the HTML file the reference was found in, relative to dist/
  attribute: 'href' | 'src';
  target: string; // the raw attribute value
}

async function findHtmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findHtmlFiles(full)));
    } else if (entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

function extractReferences(html: string, relativeFile: string): Reference[] {
  const refs: Reference[] = [];
  const attrPattern = /(href|src)=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(html)) !== null) {
    refs.push({ file: relativeFile, attribute: match[1] as 'href' | 'src', target: match[2] });
  }
  return refs;
}

function isCheckable(target: string): boolean {
  if (target.startsWith('http://') || target.startsWith('https://')) return false;
  if (target.startsWith('mailto:') || target.startsWith('tel:')) return false;
  if (target.startsWith('#')) return false;
  if (target.startsWith('data:')) return false;
  return true;
}

/** Resolves a site-root-relative or relative URL against dist/, Astro's routing conventions included. */
async function resolveTarget(target: string, fromFile: string): Promise<boolean> {
  const [withoutHash] = target.split('#');
  const [urlPath] = withoutHash.split('?');
  if (urlPath === '') return true; // bare "#fragment" or "?query" on the same page

  let fsPath: string;
  if (urlPath.startsWith('/')) {
    fsPath = path.join(DIST_DIR, urlPath);
  } else {
    fsPath = path.join(path.dirname(fromFile), urlPath);
  }

  const candidates = [fsPath, path.join(fsPath, 'index.html'), `${fsPath}.html`];
  for (const candidate of candidates) {
    try {
      const s = await stat(candidate);
      if (s.isFile()) return true;
    } catch {
      // keep trying the other candidate shapes
    }
  }
  return false;
}

async function main() {
  try {
    await stat(DIST_DIR);
  } catch {
    console.error(`[check-links] ${DIST_DIR} doesn't exist. Run \`astro build\` first.`);
    process.exit(1);
  }

  const htmlFiles = await findHtmlFiles(DIST_DIR);
  if (htmlFiles.length === 0) {
    console.error(`[check-links] No .html files found under ${DIST_DIR}.`);
    process.exit(1);
  }

  const broken: { file: string; attribute: string; target: string }[] = [];
  // A page link without its trailing slash (/map instead of /map/) makes the host answer with a redirect first, which adds a round trip to every click.
  const slashless: { file: string; target: string }[] = [];

  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    const relativeFile = path.relative(DIST_DIR, file);
    const refs = extractReferences(html, file).filter((r) => isCheckable(r.target));
    for (const ref of refs) {
      const ok = await resolveTarget(ref.target, file);
      if (!ok) {
        broken.push({ file: relativeFile, attribute: ref.attribute, target: ref.target });
      } else if (ref.attribute === 'href') {
        const [urlPath] = ref.target.split('#')[0].split('?');
        if (urlPath.startsWith('/') && !urlPath.endsWith('/') && path.extname(urlPath) === '') {
          slashless.push({ file: relativeFile, target: ref.target });
        }
      }
    }
  }

  if (broken.length > 0) {
    console.error(`[check-links] ${broken.length} broken reference(s) found:`);
    for (const b of broken) {
      console.error(`  ${b.file}: ${b.attribute}="${b.target}"`);
    }
    process.exit(1);
  }

  if (slashless.length > 0) {
    console.error(`[check-links] ${slashless.length} page link(s) are missing their trailing slash:`);
    for (const l of slashless) {
      console.error(`  ${l.file}: href="${l.target}"`);
    }
    process.exit(1);
  }

  console.log(`[check-links] Checked ${htmlFiles.length} page(s), no broken internal links or images found.`);
}

main();

import fileDownload from 'js-file-download';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── YAML helpers ────────────────────────────────────────────────────────────

/**
 * Walk backwards from lineIdx to find the line index of the nearest parent key
 * (lower indentation that is a real key line, not a comment or blank).
 * Returns -1 if none found.
 */
const findYamlParentLineIdx = (lines, lineIdx) => {
  const currentIndent = lines[lineIdx].match(/^(\s*)/)[1].length;
  for (let i = lineIdx - 1; i >= 0; i--) {
    const l = lines[i];
    if (!l.trim()) continue;
    const indent = l.match(/^(\s*)/)[1].length;
    if (indent < currentIndent && /^\s*[^#\s"'\-]/.test(l)) {
      return i;
    }
  }
  return -1;
};

/**
 * Build the full array of raw key names from root down to the key on lineIdx,
 * by following parent keys up through decreasing indentation levels.
 * Returns null if the line is not a key line.
 */
const buildYamlKeyChain = (lines, lineIdx) => {
  const line = lines[lineIdx];
  const m = line.match(/^\s*([^#\s"'\-][^:]*?)\s*:/);
  if (!m) return null;

  const chain = [m[1].trim()];
  let searchIndent = line.match(/^(\s*)/)[1].length;
  if (searchIndent === 0) return chain;

  for (let i = lineIdx - 1; i >= 0; i--) {
    const l = lines[i];
    if (!l.trim()) continue;
    const indent = l.match(/^(\s*)/)[1].length;
    if (indent < searchIndent) {
      const pm = l.match(/^\s*([^#\s"'\-][^:]*?)\s*:/);
      if (pm) {
        chain.unshift(pm[1].trim());
        searchIndent = indent;
        if (searchIndent === 0) break;
      }
    }
  }

  return chain;
};

// ─── Pattern builder ─────────────────────────────────────────────────────────

/**
 * Return the ignoredKeys regex pattern string for a single toggled line, or
 * null if no meaningful key can be extracted.
 *
 * YAML: builds the full key path by traversing parent indentation levels, so
 * the pattern is precise (e.g. `settings\.providers\.VAULT\.enabled`) and does
 * not accidentally match same-named keys elsewhere.
 *
 * Container/parent keys and array items use a trailing wildcard so all
 * descendants are covered: `settings\.command_aliases(\..+)?`
 *
 * Properties: keys are already full paths, matched exactly.
 * JSON: full-path traversal isn't implemented; falls back to name-only match.
 *
 * @param {string[]} lines   All lines of the file
 * @param {number}   lineIdx The toggled line index
 * @param {string}   fileName
 * @param {string}   delimEscaped  Level delimiter, already regex-escaped
 */
const getPatternForLine = (lines, lineIdx, fileName, delimEscaped) => {
  const line = lines[lineIdx];
  const ext = fileName.split('.').pop().toLowerCase();

  // ── .properties ────────────────────────────────────────────────────────────
  if (ext === 'properties') {
    // Keys ARE the full path (e.g. some.plugin.key = value)
    const m = line.match(/^\s*([^#!\s][^=:\s]*)\s*[=:]/);
    if (!m) return null;
    return escapeRegex(m[1]);
  }

  // ── .yml / .yaml ───────────────────────────────────────────────────────────
  if (ext === 'yml' || ext === 'yaml') {
    // Array item ("  - value") → resolve to its enclosing parent key
    let resolvedIdx = lineIdx;
    if (/^\s*-\s/.test(line)) {
      const parentIdx = findYamlParentLineIdx(lines, lineIdx);
      if (parentIdx === -1) return null;
      resolvedIdx = parentIdx;
    }

    const chain = buildYamlKeyChain(lines, resolvedIdx);
    if (!chain) return null;

    // Determine if this is a container (no value after the colon)
    const resolvedLine = lines[resolvedIdx];
    const afterColon = resolvedLine.match(/^\s*[^:]+:(.*)/);
    const rest = afterColon ? afterColon[1].trim() : '';
    const isParent =
      resolvedIdx !== lineIdx // we promoted an array item to its parent
      || rest === ''
      || rest.startsWith('#');

    const fullPath = chain.map(escapeRegex).join(delimEscaped);
    // Container: also match all child paths
    return isParent ? `${fullPath}(${delimEscaped}.+)?` : fullPath;
  }

  // ── .json ───────────────────────────────────────────────────────────────────
  if (ext === 'json') {
    const m = line.match(/^\s*"([^"]+)"\s*:(.*)/);
    if (!m) return null;
    const key = m[1];
    const rest = m[2].trim().replace(/,$/, '').trim();
    const isParent = rest === '{' || rest === '[' || rest === '';
    const e = escapeRegex(key);
    // JSON doesn't have reliable indentation-based path building here;
    // use a name-only pattern with optional prefix
    return isParent
      ? `(.*${delimEscaped})?${e}(${delimEscaped}.+)?`
      : `(.*${delimEscaped})?${e}`;
  }

  return null;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build extra ignoredKeys patterns from the per-line ignore toggles.
 *
 * @param {{ [fileName: string]: string }}        fileContents
 * @param {{ [fileName: string]: Set<number> }}   ignoredLinesByFile
 * @param {string}                                levelDelimiter  (default '.')
 * @returns {string}  Newline-separated regex patterns, ready to append to ignoredKeys
 */
export const getIgnoredKeysFromLines = (fileContents, ignoredLinesByFile, levelDelimiter = '.') => {
  const patterns = new Set();
  const delimEscaped = escapeRegex(levelDelimiter);

  for (const [fileName, content] of Object.entries(fileContents)) {
    const ignoredSet = ignoredLinesByFile[fileName];
    if (!ignoredSet || ignoredSet.size === 0) continue;

    const lines = content.split('\n');
    for (const lineIdx of ignoredSet) {
      if (lineIdx >= lines.length) continue;
      const pattern = getPatternForLine(lines, lineIdx, fileName, delimEscaped);
      if (pattern) patterns.add(pattern);
    }
  }

  return [...patterns].join('\n');
};

export const getFileContents = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('abort', () => reject(new Error('file reading was aborted')));
    reader.addEventListener('error', () => reject(new Error('file reading has failed')));
    reader.addEventListener('load', () => resolve(reader.result));
    reader.readAsText(file, 'utf-8');
  });

export const getAllFileContents = async (files) => {
  const result = {};
  await Promise.all(
    files.map(async (file) => {
      result[file.name] = await getFileContents(file);
    })
  );
  return result;
};

export const downloadFiles = (files) =>
  files.forEach((file) => fileDownload(file.content, file.fileName));

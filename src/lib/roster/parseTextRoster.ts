import { Student } from '@/types/roster';

type NewStudent = Omit<Student, 'id' | 'uploadedAt'>;

const normalizeYMD = (y: number, m: number, d: number) => {
  const yyyy = String(y).padStart(4, '0');
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const extractStartDate = (input: string): string | null => {
  // ISO: 2024-01-05
  const iso = input.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return normalizeYMD(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // US-style: 1/5/2024 or 1-5-24
  const mdy = input.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (mdy) {
    let year = Number(mdy[3]);
    if (year < 100) year += 2000;
    return normalizeYMD(year, Number(mdy[1]), Number(mdy[2]));
  }

  // Month name: January 5, 2024 (also supports 5th)
  const monthName = input.match(
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/i
  );
  if (monthName) {
    const normalized = monthName[0].replace(/(\d)(st|nd|rd|th)/i, '$1');
    const d = new Date(normalized);
    if (!Number.isNaN(d.getTime())) return normalizeYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  return null;
};

const headerKeywords = [
  'first name',
  'firstname',
  'last name',
  'lastname',
  'location',
  'phone',
  'email',
  'signature',
  'attended',
  'attendedclass',
  'attended class',
  'reason for absence',
];

const isHeaderToken = (line: string) => {
  const lower = line.trim().toLowerCase();
  if (!lower) return false;
  return headerKeywords.some((k) => lower.includes(k));
};

const isHeaderContinuation = (line: string) => {
  const lower = line.trim().toLowerCase();
  return lower.startsWith('(') || lower.startsWith('or ') || lower.includes('reason for absence');
};

const computeCourseName = (rawCourseLine: string) => {
  const monthRegex =
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/i;
  const dateRegex = new RegExp(
    [
      /\b\d{4}-\d{1,2}-\d{1,2}\b/.source,
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.source,
      monthRegex.source,
    ].join('|'),
    'i'
  );

  const match = rawCourseLine.match(dateRegex);
  if (match && typeof match.index === 'number' && match.index > 0) {
    const prefix = rawCourseLine.slice(0, match.index);
    const cleaned = prefix.replace(/[-–—|]+$/g, '').trim();
    if (cleaned) return cleaned;
  }

  // fallback (strip common date patterns from anywhere)
  return rawCourseLine
    .replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, '')
    .replace(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g, '')
    .replace(monthRegex, '')
    .replace(/\b\d{1,2}:\d{2}(?:\s*[ap]m)?\s*[-–—]\s*\d{1,2}:\d{2}(?:\s*[ap]m)?\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[-–—|]+$/g, '')
    .trim();
};

type Delim = { type: 'tab' } | { type: 'spaces' };

const splitRow = (row: string, delim: Delim | null) => {
  if (delim?.type === 'tab') return row.split('\t');
  return row.split(/\s{2,}/);
};

const bannedTokens = new Set(['yes', 'no']);
const isBadCell = (value: string) => {
  const v = value.trim();
  if (!v) return true;
  const lower = v.toLowerCase();
  if (lower.includes('first name') || lower.includes('last name')) return true;
  if (bannedTokens.has(lower)) return true;
  if (lower.includes('attest') || lower.includes('agree') || lower.includes('signature')) return true;
  return false;
};

const makeStudent = (firstName: string, lastName: string, courseName: string, courseDate: string): NewStudent | null => {
  if (isBadCell(firstName) || isBadCell(lastName)) return null;
  if (firstName.length > 40 || lastName.length > 60) return null;
  const name = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();
  if (!name) return null;
  return { name, courseName, date: courseDate };
};

const parseDelimitedTable = (lines: string[], courseName: string, courseDate: string): NewStudent[] | null => {
  let firstNameIndex = -1;
  let lastNameIndex = -1;
  let headerRowIndex = -1;
  let delimiter: Delim | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const hasFirst = lower.includes('first name') || lower.includes('firstname');
    const hasLast = lower.includes('last name') || lower.includes('lastname');
    if (!hasFirst || !hasLast) continue;

    const headerLine = lines[i];
    const testDelimiter: Delim = headerLine.includes('\t') ? { type: 'tab' } : { type: 'spaces' };
    const columns = splitRow(headerLine, testDelimiter).map((c) => c.trim().toLowerCase());

    let tempFirstIdx = -1;
    let tempLastIdx = -1;
    for (let j = 0; j < columns.length; j++) {
      const normalized = columns[j].replace(/\s+/g, '');
      if (normalized === 'firstname' || columns[j].includes('first name')) tempFirstIdx = j;
      if (normalized === 'lastname' || columns[j].includes('last name')) tempLastIdx = j;
    }

    if (tempFirstIdx !== -1 && tempLastIdx !== -1) {
      firstNameIndex = tempFirstIdx;
      lastNameIndex = tempLastIdx;
      headerRowIndex = i;
      delimiter = testDelimiter;
      break;
    }
  }

  if (headerRowIndex === -1) return null;

  const students: NewStudent[] = [];
  const maxIndex = Math.max(firstNameIndex, lastNameIndex);
  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const cols = splitRow(lines[i], delimiter).map((c) => c.trim());
    if (cols.length <= maxIndex) continue;
    const student = makeStudent(cols[firstNameIndex] ?? '', cols[lastNameIndex] ?? '', courseName, courseDate);
    if (student) students.push(student);
  }
  return students;
};

/**
 * Fallback for PDFs/Word where each table cell becomes its own line (e.g., "First Name" and "Last Name" are on separate lines).
 */
const parseVerticalCellTable = (lines: string[], courseName: string, courseDate: string): NewStudent[] | null => {
  const lowerLines = lines.map((l) => l.trim().toLowerCase());

  // Find "first name" then a nearby "last name" (within 10 lines)
  let firstIdxLine = -1;
  let lastIdxLine = -1;
  for (let i = 0; i < lowerLines.length; i++) {
    if (!(lowerLines[i].includes('first name') || lowerLines[i].includes('firstname'))) continue;
    for (let j = i + 1; j < Math.min(i + 11, lowerLines.length); j++) {
      if (lowerLines[j].includes('last name') || lowerLines[j].includes('lastname')) {
        firstIdxLine = i;
        lastIdxLine = j;
        break;
      }
    }
    if (firstIdxLine !== -1) break;
  }
  if (firstIdxLine === -1) return null;

  // Expand to include neighboring header tokens (Location/Phone/etc.)
  let headerStart = firstIdxLine;
  while (headerStart > 0 && isHeaderToken(lines[headerStart - 1]) && firstIdxLine - (headerStart - 1) <= 8) {
    headerStart--;
  }

  let headerEnd = lastIdxLine;
  while (headerEnd + 1 < lines.length && isHeaderToken(lines[headerEnd + 1]) && headerEnd + 1 - firstIdxLine <= 30) {
    headerEnd++;
  }

  const headerRaw = lines.slice(headerStart, headerEnd + 1);
  const headers: string[] = [];
  for (const h of headerRaw) {
    if (headers.length > 0 && isHeaderContinuation(h)) {
      headers[headers.length - 1] = `${headers[headers.length - 1]} ${h}`.replace(/\s+/g, ' ').trim();
      continue;
    }
    headers.push(h.trim());
  }

  const firstNameIndex = headers.findIndex((h) => {
    const n = h.toLowerCase().replace(/\s+/g, '');
    return n.includes('firstname');
  });
  const lastNameIndex = headers.findIndex((h) => {
    const n = h.toLowerCase().replace(/\s+/g, '');
    return n.includes('lastname');
  });
  if (firstNameIndex === -1 || lastNameIndex === -1) return null;

  const rowSize = headers.length;
  if (rowSize < 2) return null;

  const cells = lines.slice(headerEnd + 1).map((c) => c.trim()).filter(Boolean);
  const students: NewStudent[] = [];

  for (let i = 0; i + rowSize <= cells.length; i += rowSize) {
    const row = cells.slice(i, i + rowSize);
    const rowLower = row.map((c) => c.toLowerCase());

    // Skip repeated header blocks on later pages
    const looksLikeHeaderAgain = rowLower.some((c) => c.includes('first name') || c.includes('last name'));
    if (looksLikeHeaderAgain) continue;

    const student = makeStudent(row[firstNameIndex] ?? '', row[lastNameIndex] ?? '', courseName, courseDate);
    if (student) students.push(student);
  }

  return students;
};

export const parseTextRoster = (text: string): NewStudent[] => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) return [];

  // Line 1: Course title (may contain dates too)
  const rawCourseLine = lines[0].trim();
  const courseDate = extractStartDate(lines[1]) ?? extractStartDate(rawCourseLine) ?? 'Unknown';
  const courseName = computeCourseName(rawCourseLine);

  // 1) Try "normal" header row where First/Last are on the same line.
  const delimited = parseDelimitedTable(lines, courseName, courseDate);
  if (delimited && delimited.length > 0) {
    console.info('[roster] parsed delimited table rows:', delimited.length);
    return delimited;
  }

  // 2) Fallback: each cell is its own line (common with PDF text extraction)
  const vertical = parseVerticalCellTable(lines, courseName, courseDate);
  if (vertical && vertical.length > 0) {
    console.info('[roster] parsed vertical cell table rows:', vertical.length);
    return vertical;
  }

  console.info('[roster] no students parsed (headers not found or no valid rows)');
  return [];
};

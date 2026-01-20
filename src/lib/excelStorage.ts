import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { Student, RosterUpload } from '@/types/roster';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const STORAGE_KEY = 'instructor_roster_data';
const UPLOADS_KEY = 'instructor_roster_uploads';

export const getStudents = (): Student[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveStudents = (students: Student[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
};

export const addStudents = (newStudents: Omit<Student, 'id' | 'uploadedAt'>[]): Student[] => {
  const existing = getStudents();
  const now = new Date().toISOString();
  const studentsWithIds = newStudents.map((s, i) => ({
    ...s,
    id: `${Date.now()}-${i}`,
    uploadedAt: now,
  }));
  const updated = [...existing, ...studentsWithIds];
  saveStudents(updated);
  return updated;
};

export const getUploads = (): RosterUpload[] => {
  const data = localStorage.getItem(UPLOADS_KEY);
  return data ? JSON.parse(data) : [];
};

export const addUpload = (upload: Omit<RosterUpload, 'id' | 'uploadedAt'>): void => {
  const existing = getUploads();
  const newUpload: RosterUpload = {
    ...upload,
    id: Date.now().toString(),
    uploadedAt: new Date().toISOString(),
  };
  localStorage.setItem(UPLOADS_KEY, JSON.stringify([...existing, newUpload]));
};

export const exportToExcel = (): void => {
  const students = getStudents();
  if (students.length === 0) {
    alert('No data to export');
    return;
  }

  const exportData = students.map(s => ({
    'Student Name': s.name,
    'Course Name': s.courseName,
    'Date': s.date,
    'Uploaded At': new Date(s.uploadedAt).toLocaleDateString(),
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Roster Data');
  
  const colWidths = [
    { wch: 25 },
    { wch: 30 },
    { wch: 15 },
    { wch: 15 },
  ];
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, `roster_export_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// Parse text content to extract student data
const parseTextContent = (text: string): Omit<Student, 'id' | 'uploadedAt'>[] => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  const students: Omit<Student, 'id' | 'uploadedAt'>[] = [];
  if (lines.length < 2) return students;

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

  // Line 1: Course title
  const rawCourseLine = lines[0].trim();

  // Line 2: Date range line (we only keep the start date)
  const courseDate = extractStartDate(lines[1]) ?? extractStartDate(rawCourseLine) ?? 'Unknown';

  // Ensure we don't accidentally treat date text as part of the course name
  const courseName = rawCourseLine
    .replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, '')
    .replace(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g, '')
    .replace(
      /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi,
      ''
    )
    .replace(/\s{2,}/g, ' ')
    .replace(/[-–—|]+$/g, '')
    .trim();

  // Find the header row with BOTH "First Name" and "Last Name" columns
  let firstNameIndex = -1;
  let lastNameIndex = -1;
  let headerRowIndex = -1;

  type Delim = { type: 'tab' } | { type: 'spaces' };
  let delimiter: Delim | null = null;

  const splitRow = (row: string) => {
    if (delimiter?.type === 'tab') return row.split('\t');
    // IMPORTANT: don't split on commas; commas appear in other text (e.g. "yes, and I attest...")
    return row.split(/\s{2,}/);
  };

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const hasFirst = lower.includes('first name') || lower.includes('firstname');
    const hasLast = lower.includes('last name') || lower.includes('lastname');
    if (!hasFirst || !hasLast) continue;

    const headerLine = lines[i];
    delimiter = headerLine.includes('\t') ? { type: 'tab' } : { type: 'spaces' };

    const columns = splitRow(headerLine).map((c) => c.trim().toLowerCase());
    for (let j = 0; j < columns.length; j++) {
      const normalized = columns[j].replace(/\s+/g, '');
      if (normalized === 'firstname' || columns[j].includes('first name')) firstNameIndex = j;
      if (normalized === 'lastname' || columns[j].includes('last name')) lastNameIndex = j;
    }

    if (firstNameIndex !== -1 && lastNameIndex !== -1) {
      headerRowIndex = i;
      break;
    }
  }

  // Strict mode: if we can't find BOTH columns, import nothing (prevents garbage like "yes, and I attest...")
  if (headerRowIndex === -1) return students;

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

  const maxIndex = Math.max(firstNameIndex, lastNameIndex);

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]).map((c) => c.trim());
    if (cols.length <= maxIndex) continue;

    const firstName = cols[firstNameIndex] ?? '';
    const lastName = cols[lastNameIndex] ?? '';

    // Only accept rows that have BOTH first + last name values
    if (isBadCell(firstName) || isBadCell(lastName)) continue;

    // Guardrails: names should be relatively short
    if (firstName.length > 40 || lastName.length > 60) continue;

    const fullName = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();
    if (!fullName) continue;

    students.push({
      name: fullName,
      courseName,
      date: courseDate,
    });
  }

  return students;
};

// Import from Word document
const importFromWord = async (file: File): Promise<Student[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const students = parseTextContent(result.value);
  return addStudents(students);
};

// Import from PDF
const importFromPDF = async (file: File): Promise<Student[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  
  const students = parseTextContent(fullText);
  return addStudents(students);
};

// Import from Excel
const importFromExcelFile = (file: File): Promise<Student[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        const students: Omit<Student, 'id' | 'uploadedAt'>[] = jsonData
          .map((row: any) => {
            const firstName =
              row['First Name'] ?? row['FirstName'] ?? row['first name'] ?? row['firstname'] ?? '';
            const lastName =
              row['Last Name'] ?? row['LastName'] ?? row['last name'] ?? row['lastname'] ?? '';

            const combinedName = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();
            const name =
              row['Student Name'] || row['Name'] || row['name'] || row['Student'] || combinedName || '';

            return {
              name: String(name).trim(),
              courseName: String(
                row['Course Name'] || row['Course'] || row['course'] || row['Class'] || ''
              ).trim(),
              date: String(row['Date'] || row['date'] || new Date().toISOString().split('T')[0]).trim(),
            };
          })
          .filter((s) => s.name);

        resolve(addStudents(students));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// Main import function that handles all file types
export const importFromExcel = async (file: File): Promise<Student[]> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'xlsx':
    case 'xls':
      return importFromExcelFile(file);
    case 'doc':
    case 'docx':
      return importFromWord(file);
    case 'pdf':
      return importFromPDF(file);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
};

export const clearAllData = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(UPLOADS_KEY);
};

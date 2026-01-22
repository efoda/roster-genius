import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { Student, RosterUpload } from '@/types/roster';
import { parseTextRoster } from '@/lib/roster/parseTextRoster';

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

// Parse text content to extract student data (PDF/Word)
const parseTextContent = (text: string): Omit<Student, 'id' | 'uploadedAt'>[] => parseTextRoster(text);

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

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
  const lines = text.split('\n').filter(line => line.trim());
  const students: Omit<Student, 'id' | 'uploadedAt'>[] = [];
  
  // First non-empty line is the course name
  let currentCourse = lines.length > 0 ? lines[0].trim() : '';
  let currentDate = new Date().toISOString().split('T')[0];
  
  // Check for date patterns in the document
  const datePatterns = [/date[:\s]+(.+)/i, /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/];
  
  // Start from line 1 (skip first line which is course name)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for date
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        currentDate = match[1].trim();
        break;
      }
    }
    
    // Check if line looks like a student name (simple heuristic)
    const trimmedLine = line.trim();
    if (trimmedLine && 
        !trimmedLine.toLowerCase().includes('date') &&
        !trimmedLine.toLowerCase().includes('roster') &&
        !trimmedLine.toLowerCase().includes('student name') &&
        !trimmedLine.toLowerCase().includes('participants') &&
        !trimmedLine.match(/^\d+[\.:\)]\s*$/) && // Skip numbered lines without names
        trimmedLine.length > 2 &&
        trimmedLine.length < 100 &&
        /^[a-zA-Z\d]/.test(trimmedLine)) {
      // Remove leading numbers/bullets (e.g., "1. John Doe" -> "John Doe")
      const cleanedName = trimmedLine.replace(/^[\d]+[\.:\)\-\s]+/, '').trim();
      if (cleanedName.length > 2) {
        students.push({
          name: cleanedName,
          courseName: currentCourse,
          date: currentDate,
        });
      }
    }
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
        
        const students: Omit<Student, 'id' | 'uploadedAt'>[] = jsonData.map((row: any) => ({
          name: row['Student Name'] || row['Name'] || row['name'] || row['Student'] || '',
          courseName: row['Course Name'] || row['Course'] || row['course'] || row['Class'] || '',
          date: row['Date'] || row['date'] || new Date().toISOString().split('T')[0],
        })).filter(s => s.name);

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

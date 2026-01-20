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
  
  if (lines.length < 2) return students;
  
  // Line 1: Course title
  const courseName = lines[0].trim();
  
  // Line 2: Extract start date (first date found)
  const dateMatch = lines[1].match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  const courseDate = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
  
  // Find the header row with "First Name" and "Last Name" columns
  let firstNameIndex = -1;
  let lastNameIndex = -1;
  let headerRowIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    // Check if this line contains column headers
    if (line.includes('first name') || line.includes('firstname')) {
      // Split by common delimiters (tab, multiple spaces, comma)
      const columns = lines[i].split(/\t|,|(?:\s{2,})/).map(c => c.trim().toLowerCase());
      
      for (let j = 0; j < columns.length; j++) {
        if (columns[j].includes('first name') || columns[j] === 'firstname') {
          firstNameIndex = j;
        }
        if (columns[j].includes('last name') || columns[j] === 'lastname') {
          lastNameIndex = j;
        }
      }
      
      if (firstNameIndex !== -1) {
        headerRowIndex = i;
        break;
      }
    }
  }
  
  // If we found headers, extract student names from subsequent rows
  if (headerRowIndex !== -1 && firstNameIndex !== -1) {
    for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const columns = lines[i].split(/\t|,|(?:\s{2,})/).map(c => c.trim());
      
      if (columns.length > firstNameIndex) {
        const firstName = columns[firstNameIndex] || '';
        const lastName = lastNameIndex !== -1 && columns.length > lastNameIndex ? columns[lastNameIndex] : '';
        
        // Skip empty or header-like rows
        if (firstName && !firstName.toLowerCase().includes('first name')) {
          const fullName = lastName ? `${firstName} ${lastName}` : firstName;
          if (fullName.trim().length > 1) {
            students.push({
              name: fullName.trim(),
              courseName: courseName,
              date: courseDate,
            });
          }
        }
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

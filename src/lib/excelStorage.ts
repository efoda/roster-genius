import * as XLSX from 'xlsx';
import { Student, RosterUpload } from '@/types/roster';

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
  
  // Auto-size columns
  const colWidths = [
    { wch: 25 }, // Student Name
    { wch: 30 }, // Course Name
    { wch: 15 }, // Date
    { wch: 15 }, // Uploaded At
  ];
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, `roster_export_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const importFromExcel = (file: File): Promise<Student[]> => {
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

export const clearAllData = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(UPLOADS_KEY);
};

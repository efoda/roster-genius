export interface Student {
  id: string;
  name: string;
  courseName: string;
  date: string;
  uploadedAt: string;
}

export interface RosterUpload {
  id: string;
  fileName: string;
  uploadedAt: string;
  studentCount: number;
}

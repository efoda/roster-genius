import { Student } from '@/types/roster';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users } from 'lucide-react';

interface StudentTableProps {
  students: Student[];
}

const StudentTable = ({ students }: StudentTableProps) => {
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Users className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No students yet</p>
        <p className="text-sm">Upload a roster to get started</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Student Name</TableHead>
            <TableHead className="font-semibold">Course</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold">Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.slice(-50).reverse().map((student) => (
            <TableRow key={student.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-medium">{student.name}</TableCell>
              <TableCell>{student.courseName}</TableCell>
              <TableCell>{student.date}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(student.uploadedAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {students.length > 50 && (
        <div className="px-4 py-3 bg-muted/30 text-center text-sm text-muted-foreground">
          Showing last 50 of {students.length} students
        </div>
      )}
    </div>
  );
};

export default StudentTable;

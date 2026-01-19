import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/Header';
import FileUpload from '@/components/FileUpload';
import StudentTable from '@/components/StudentTable';
import StatsCards from '@/components/StatsCards';
import Analytics from '@/components/Analytics';
import { Student } from '@/types/roster';
import { getStudents, importFromExcel, addUpload } from '@/lib/excelStorage';
import { toast } from 'sonner';
import { Upload, Users, BarChart3 } from 'lucide-react';

const Index = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');

  useEffect(() => {
    setStudents(getStudents());
  }, []);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (!['xlsx', 'xls', 'csv'].includes(extension || '')) {
        toast.error('Please upload an Excel or CSV file');
        return;
      }

      const updatedStudents = await importFromExcel(file);
      addUpload({
        fileName: file.name,
        studentCount: updatedStudents.length - students.length,
      });
      
      setStudents(updatedStudents);
      toast.success(`Successfully imported ${updatedStudents.length - students.length} students`);
      setActiveTab('students');
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Error processing file. Please check the format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDataCleared = () => {
    setStudents([]);
    toast.success('All data cleared');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onDataCleared={handleDataCleared} hasData={students.length > 0} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <StatsCards students={students} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3 mx-auto">
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="w-4 h-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-2">
              <Users className="w-4 h-4" />
              Students
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="max-w-2xl mx-auto">
            <FileUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
            <p className="text-center text-sm text-muted-foreground mt-4">
              Upload Excel (.xlsx, .xls) or CSV files containing student rosters
            </p>
          </TabsContent>

          <TabsContent value="students">
            <StudentTable students={students} />
          </TabsContent>

          <TabsContent value="analytics">
            <Analytics students={students} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;

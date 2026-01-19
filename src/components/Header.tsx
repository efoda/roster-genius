import { GraduationCap, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToExcel, clearAllData } from '@/lib/excelStorage';

interface HeaderProps {
  onDataCleared: () => void;
  hasData: boolean;
}

const Header = ({ onDataCleared, hasData }: HeaderProps) => {
  const handleClear = () => {
    if (confirm('Are you sure you want to delete all data? This cannot be undone.')) {
      clearAllData();
      onDataCleared();
    }
  };

  return (
    <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Roster Manager</h1>
            <p className="text-xs text-muted-foreground">Upload & Analyze Student Data</p>
          </div>
        </div>
        
        {hasData && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-2">
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear} className="gap-2 text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" />
              Clear
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;

import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, FileText, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

const FileUpload = ({ onFileSelect, isProcessing }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer group",
        isDragging 
          ? "border-primary bg-primary/5 scale-[1.02]" 
          : "border-border hover:border-primary/50 hover:bg-muted/50",
        isProcessing && "pointer-events-none opacity-60"
      )}
    >
      <input
        type="file"
        accept=".xlsx,.xls,.csv,.docx,.doc,.pdf"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isProcessing}
      />
      
      <div className="flex flex-col items-center gap-4">
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
          isDragging ? "bg-primary text-primary-foreground" : "bg-muted group-hover:bg-primary/10"
        )}>
          {isProcessing ? (
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className={cn(
              "w-8 h-8 transition-colors",
              isDragging ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
            )} />
          )}
        </div>
        
        <div>
          <p className="text-lg font-medium text-foreground">
            {isProcessing ? "Processing file..." : "Drop your roster file here"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to browse
          </p>
        </div>

        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>Word</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <File className="w-4 h-4" />
            <span>PDF</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;

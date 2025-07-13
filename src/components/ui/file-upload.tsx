import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  accept?: string;
  maxSize?: number;
  isUploading?: boolean;
  uploadProgress?: number;
}

export function FileUpload({ 
  onFileUpload, 
  accept = '.csv,.xlsx,.xls', 
  maxSize = 10 * 1024 * 1024,
  isUploading = false,
  uploadProgress = 0
}: FileUploadProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      onFileUpload(file);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxSize,
    multiple: false
  });

  const removeFile = () => {
    setUploadedFile(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full space-y-4">
      {!uploadedFile ? (
        <Card className="border-dashed border-2 bg-gradient-card">
          <CardContent className="p-8">
            <div
              {...getRootProps()}
              className={`
                cursor-pointer text-center transition-all duration-300
                ${isDragActive ? 'opacity-80 scale-105' : 'opacity-100'}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {isDragActive ? 'Drop your trading file here' : 'Upload Trading Records'}
              </h3>
              <p className="text-muted-foreground mb-4">
                Drag and drop your CSV or Excel file, or click to browse
              </p>
              <Button variant="outline" className="bg-primary/10 border-primary/20 hover:bg-primary/20">
                Choose File
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Supports CSV, XLSX, XLS files up to {formatFileSize(maxSize)}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{uploadedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(uploadedFile.size)}
                  </p>
                </div>
              </div>
              {!isUploading && (
                <Button variant="ghost" size="sm" onClick={removeFile}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {isUploading && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Analyzing your trades...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import { useState, useRef } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';

interface UploadDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onSuccess?: () => void;
}

interface UploadedFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export default function UploadDocumentsModal({ 
  isOpen, 
  onClose, 
  projectId,
  onSuccess 
}: UploadDocumentsModalProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Validate files
    const validFiles = selectedFiles.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      const validExtensions = ['.pdf', '.docx', '.xlsx'];
      const maxSize = 50 * 1024 * 1024; // 50MB
      
      if (!validExtensions.includes(extension)) {
        alert(`File ${file.name} has unsupported format`);
        return false;
      }
      
      if (file.size > maxSize) {
        alert(`File ${file.name} is too large (max 50MB)`);
        return false;
      }
      
      return true;
    });

    // Add to files list
    const uploadFiles: UploadedFile[] = validFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...uploadFiles]);
  };

  const handleChooseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Please select files to upload');
      return;
    }

    setIsUploading(true);

    try {
      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const uploadFile = files[i];
        
        // Update status to uploading
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'uploading' as const } : f
        ));

        const formData = new FormData();
        formData.append('file', uploadFile.file);

        try {
          const response = await fetch(
            `http://localhost:8000/api/v1/projects/${projectId}/documents`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
              },
              body: formData,
            }
          );

          if (!response.ok) {
            throw new Error('Upload failed');
          }

          // Update status to success
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, status: 'success' as const, progress: 100 } : f
          ));
        } catch (error) {
          // Update status to error
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { 
              ...f, 
              status: 'error' as const, 
              error: error instanceof Error ? error.message : 'Upload failed'
            } : f
          ));
        }
      }

      // Check if all uploads were successful
      const allSuccess = files.every(f => f.status === 'success');
      
      if (allSuccess && onSuccess) {
        onSuccess();
      }

      // Close modal after a delay if all successful
      if (allSuccess) {
        setTimeout(() => {
          handleClose();
        }, 1500);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    onClose();
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (ext === 'docx' || ext === 'doc') return '📝';
    if (ext === 'xlsx' || ext === 'xls') return '📊';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Documents"
      size="lg"
    >
      <div className="space-y-6">
        {/* File input (hidden) */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Drop zone */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <div className="space-y-4">
            <div className="mx-auto h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📄</span>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Upload Specification Documents</h3>
              <p className="mt-2 text-sm text-gray-500">
                Upload PDF documents containing supplier specifications
              </p>
            </div>
            <div>
              <Button onClick={handleChooseFiles} disabled={isUploading}>
                Choose Files
              </Button>
            </div>
          </div>
        </div>

        {/* Selected files list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900">Selected Files ({files.length})</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {files.map((uploadFile, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <span className="text-2xl">{getFileIcon(uploadFile.file.name)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {uploadFile.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(uploadFile.file.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {uploadFile.status === 'pending' && (
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="text-gray-400 hover:text-red-600"
                        disabled={isUploading}
                      >
                        ✕
                      </button>
                    )}
                    {uploadFile.status === 'uploading' && (
                      <span className="text-blue-600">⏳</span>
                    )}
                    {uploadFile.status === 'success' && (
                      <span className="text-green-600">✓</span>
                    )}
                    {uploadFile.status === 'error' && (
                      <span className="text-red-600" title={uploadFile.error}>
                        ⚠️
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Supported formats info */}
        <div className="text-sm text-gray-500">
          <p className="font-medium mb-2">Supported formats:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>PDF documents (.pdf)</li>
            <li>Word documents (.docx)</li>
            <li>Excel spreadsheets (.xlsx)</li>
            <li>Maximum file size: 50MB per file</li>
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end space-x-3">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading}
            isLoading={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Process Documents'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

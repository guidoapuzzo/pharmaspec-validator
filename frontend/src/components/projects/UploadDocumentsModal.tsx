import { useState, useRef } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import { API_V1_URL } from '@/config/api';

interface UploadDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onSuccess?: () => void;
}

interface UploadedFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  error?: string;
  documentId?: number;
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

  const pollDocumentStatus = async (documentId: number, fileIndex: number): Promise<void> => {
    const maxAttempts = 60; // Poll for up to 5 minutes (60 * 5 seconds)
    let attempts = 0;

    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(
          `${API_V1_URL}/projects/${projectId}/documents/${documentId}/status`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            },
          }
        );

        // Handle 401 unauthorized
        if (response.status === 401) {
          console.error('Authentication failed during polling');
          setFiles(prev => prev.map((f, idx) =>
            idx === fileIndex ? {
              ...f,
              status: 'error' as const,
              error: 'Authentication failed. Please refresh the page and try again.'
            } : f
          ));
          return;
        }

        if (response.ok) {
          const status = await response.json();

          if (status.extraction_status === 'completed') {
            setFiles(prev => prev.map((f, idx) =>
              idx === fileIndex ? { ...f, status: 'success' as const, progress: 100 } : f
            ));
            return;
          } else if (status.extraction_status === 'failed') {
            setFiles(prev => prev.map((f, idx) =>
              idx === fileIndex ? {
                ...f,
                status: 'error' as const,
                error: status.extraction_error || 'Processing failed'
              } : f
            ));
            return;
          }
        } else {
          // Handle other non-200 responses
          console.error(`Status check failed with status ${response.status}`);
        }

        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          return poll();
        } else {
          // Timeout
          setFiles(prev => prev.map((f, idx) =>
            idx === fileIndex ? {
              ...f,
              status: 'error' as const,
              error: 'Processing timeout'
            } : f
          ));
        }
      } catch (error) {
        console.error('Error polling status:', error);
        setFiles(prev => prev.map((f, idx) =>
          idx === fileIndex ? {
            ...f,
            status: 'error' as const,
            error: 'Status check failed'
          } : f
        ));
      }
    };

    return poll();
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Please select files to upload');
      return;
    }

    setIsUploading(true);
    let allSuccessful = true;

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
            `${API_V1_URL}/projects/${projectId}/documents`,
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

          const data = await response.json();
          
          // Update status to processing and store document ID
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { 
              ...f, 
              status: 'processing' as const, 
              progress: 50,
              documentId: data.id 
            } : f
          ));

          // Start polling for processing completion
          console.log(`Document ${data.id} uploaded, processing in background...`);
          pollDocumentStatus(data.id, i);
          
        } catch (error) {
          allSuccessful = false;
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

      // Call success callback if all uploaded (even if still processing)
      if (allSuccessful && onSuccess) {
        onSuccess();
        // Close modal after a brief delay to show processing started
        setTimeout(() => {
          handleClose();
        }, 1000);
      }

    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    // Only allow close if not uploading
    if (!isUploading) {
      setFiles([]);
      onClose();
    }
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

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return null;
      case 'uploading':
        return <span className="text-blue-600">⏳</span>;
      case 'processing':
        return <span className="text-yellow-600">⚙️</span>;
      case 'success':
        return <span className="text-green-600">✓</span>;
      case 'error':
        return <span className="text-red-600">⚠️</span>;
    }
  };

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return 'Ready';
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing with AI...';
      case 'success':
        return 'Complete';
      case 'error':
        return 'Failed';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const canClose = !isUploading;
  const hasProcessingFiles = files.some(f => f.status === 'processing');

  return (
    <Modal
      isOpen={isOpen}
      onClose={canClose ? handleClose : () => {}}
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
          disabled={isUploading}
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
                      <div className="flex items-center space-x-2">
                        <p className="text-xs text-gray-500">
                          {formatFileSize(uploadFile.file.size)}
                        </p>
                        <span className="text-xs text-gray-400">•</span>
                        <p className="text-xs text-gray-500">
                          {getStatusText(uploadFile.status)}
                        </p>
                      </div>
                      {uploadFile.error && (
                        <p className="text-xs text-red-600 mt-1" title={uploadFile.error}>
                          {uploadFile.error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(uploadFile.status)}
                    {uploadFile.status === 'pending' && (
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="text-gray-400 hover:text-red-600"
                        disabled={isUploading}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing notice */}
        {hasProcessingFiles && (
          <div className="rounded-md bg-blue-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-blue-400">ℹ️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Processing in Background</h3>
                <div className="mt-2 text-sm text-blue-700">
                  Documents are being processed by AI. This may take a few minutes. You can close this dialog and continue working.
                </div>
              </div>
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
            disabled={!canClose}
          >
            {hasProcessingFiles ? 'Close' : 'Cancel'}
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

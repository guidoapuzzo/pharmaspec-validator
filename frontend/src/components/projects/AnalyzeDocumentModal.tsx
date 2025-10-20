import { useState, useEffect, useRef } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import { API_V1_URL } from '@/config/api';

interface AnalyzeDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  documents: Document[];
  requirements: Requirement[];
  matrixEntries: MatrixEntry[];
  onSuccess?: () => void;
}

interface Document {
  id: number;
  original_filename: string;
  extraction_status: string;
  extracted_json?: any;
}

interface Requirement {
  id: number;
  requirement_id: string;
  description: string;
  category: string | null;
}

interface MatrixEntry {
  id: number;
  requirement_id: number;
  compliance_status: string | null;
}

export default function AnalyzeDocumentModal({
  isOpen,
  onClose,
  projectId,
  documents,
  requirements,
  matrixEntries,
  onSuccess
}: AnalyzeDocumentModalProps) {
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<Set<number>>(new Set());
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{current: number, total: number} | null>(null);
  const [results, setResults] = useState<any>(null);

  // Helper to check if requirement has existing matrix entry
  const hasMatrixEntry = (requirementId: number) => {
    return matrixEntries.some(entry => entry.requirement_id === requirementId);
  };

  // Filter to only show completed documents
  const completedDocuments = documents.filter(
    doc => doc.extraction_status === 'completed'
  );

  // Track previous isOpen state to only reset on open transition
  const prevIsOpenRef = useRef(isOpen);

  // Reset state when modal opens (not when already open and re-rendering)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Modal just opened (transition from closed to open)
      setSelectedDocumentId(null);
      setSelectedRequirementIds(new Set());
      setForceRegenerate(false);
      setError(null);
      setProgress(null);
      setResults(null);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  const handleRequirementToggle = (reqId: number) => {
    const newSelected = new Set(selectedRequirementIds);
    if (newSelected.has(reqId)) {
      newSelected.delete(reqId);
    } else {
      newSelected.add(reqId);
    }
    setSelectedRequirementIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRequirementIds.size === requirements.length) {
      setSelectedRequirementIds(new Set());
    } else {
      setSelectedRequirementIds(new Set(requirements.map(r => r.id)));
    }
  };

  const handleAnalyze = async () => {
    if (!selectedDocumentId) {
      setError('Please select a document');
      return;
    }

    if (selectedRequirementIds.size === 0) {
      setError('Please select at least one requirement');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setProgress({ current: 0, total: selectedRequirementIds.size });

    try {
      const response = await fetch(
        `${API_V1_URL}/projects/${projectId}/analyze`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_id: selectedDocumentId,
            requirement_ids: Array.from(selectedRequirementIds),
            force_regenerate: forceRegenerate
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Analysis failed' }));
        throw new Error(errorData.detail || 'Failed to analyze document');
      }

      const data = await response.json();
      setResults(data);
      setProgress({ current: selectedRequirementIds.size, total: selectedRequirementIds.size });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze document');
      setProgress(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClose = () => {
    if (!isAnalyzing) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Analyze Document"
      size="lg"
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {!results ? (
          <>
            {/* Document Selection */}
            <div>
              <label htmlFor="document" className="block text-sm font-medium text-gray-700">
                Select Document *
              </label>
              <select
                id="document"
                value={selectedDocumentId || ''}
                onChange={(e) => setSelectedDocumentId(Number(e.target.value) || null)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900"
                disabled={isAnalyzing}
              >
                <option value="">-- Select a document --</option>
                {completedDocuments.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.original_filename}
                  </option>
                ))}
              </select>
              {completedDocuments.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  No processed documents available. Please upload and process a document first.
                </p>
              )}
            </div>

            {/* Requirements Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Select Requirements * ({selectedRequirementIds.size} selected)
                </label>
                {requirements.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-800"
                    disabled={isAnalyzing}
                  >
                    {selectedRequirementIds.size === requirements.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {requirements.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No requirements available. Please add requirements first.
                </p>
              ) : (
                <div className="border border-gray-300 rounded-md max-h-64 overflow-y-auto">
                  {requirements.map((req) => {
                    const hasEntry = hasMatrixEntry(req.id);
                    return (
                      <div
                        key={req.id}
                        className={`flex items-start p-3 hover:bg-gray-50 border-b border-gray-200 last:border-b-0 ${
                          hasEntry ? 'bg-blue-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={`req-${req.id}`}
                          checked={selectedRequirementIds.has(req.id)}
                          onChange={() => handleRequirementToggle(req.id)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          disabled={isAnalyzing}
                        />
                        <label htmlFor={`req-${req.id}`} className="ml-3 flex-1 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900">
                              {req.requirement_id}
                            </div>
                            {hasEntry && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" title="Already has matrix entry">
                                ✓ Analyzed
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {req.description}
                          </div>
                          {req.category && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 mt-1">
                              {req.category}
                            </span>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Force Regenerate Option */}
            {requirements.some(req => hasMatrixEntry(req.id)) && (
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="force-regenerate"
                    type="checkbox"
                    checked={forceRegenerate}
                    onChange={(e) => setForceRegenerate(e.target.checked)}
                    disabled={isAnalyzing}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="force-regenerate" className="font-medium text-gray-700 cursor-pointer">
                    Force regenerate existing entries
                  </label>
                  <p className="text-gray-500">
                    Replace existing matrix entries for selected requirements (cannot be undone)
                  </p>
                </div>
              </div>
            )}

            {/* Progress Indicator */}
            {progress && (
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-blue-400">⚙️</span>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-blue-800">Analyzing...</h3>
                    <div className="mt-2">
                      <div className="text-sm text-blue-700">
                        Processing requirement {progress.current} of {progress.total}
                      </div>
                      <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Results Display */
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-green-400">✓</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Analysis Complete</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>{results.message}</p>
                  <p className="mt-1">Generated {results.entries?.length || 0} matrix entries</p>
                  {results.skipped > 0 && (
                    <p className="mt-1">Skipped {results.skipped} requirements (already analyzed)</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isAnalyzing}
          >
            {results ? 'Close' : 'Cancel'}
          </Button>
          {!results && (
            <Button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || completedDocuments.length === 0 || requirements.length === 0}
              isLoading={isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

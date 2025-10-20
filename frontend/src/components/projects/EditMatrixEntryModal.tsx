import { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import { API_V1_URL } from '@/config/api';

interface EditMatrixEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: MatrixEntry | null;
  requirement: Requirement | null;
  document: Document | null;
  onSuccess?: () => void;
}

interface MatrixEntry {
  id: number;
  requirement_id: number;
  document_id: number;
  spec_reference: string | null;
  supplier_response: string | null;
  justification: string | null;
  compliance_status: string | null;
  test_reference: string | null;
  risk_assessment: string | null;
  comments: string | null;
  review_status: string;
  reviewer_comments: string | null;
  generation_model: string | null;
  created_at: string;
}

interface Requirement {
  id: number;
  requirement_id: string;
  description: string;
  category: string | null;
}

interface Document {
  id: number;
  original_filename: string;
}

export default function EditMatrixEntryModal({
  isOpen,
  onClose,
  entry,
  requirement,
  document,
  onSuccess
}: EditMatrixEntryModalProps) {
  const [formData, setFormData] = useState({
    spec_reference: '',
    supplier_response: '',
    justification: '',
    compliance_status: '',
    test_reference: '',
    risk_assessment: '',
    comments: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with entry data
  useEffect(() => {
    if (entry && isOpen) {
      setFormData({
        spec_reference: entry.spec_reference || '',
        supplier_response: entry.supplier_response || '',
        justification: entry.justification || '',
        compliance_status: entry.compliance_status || '',
        test_reference: entry.test_reference || '',
        risk_assessment: entry.risk_assessment || '',
        comments: entry.comments || ''
      });
      setError(null);
    }
  }, [entry, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_V1_URL}/matrix/${entry.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Update failed' }));
        throw new Error(errorData.detail || 'Failed to update matrix entry');
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update matrix entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!entry) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Matrix Entry"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
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

        {/* Requirement and Document Info (Read-only) */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          {requirement && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Requirement</h3>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="font-medium text-gray-600">ID: </span>
                  <span className="text-gray-900">{requirement.requirement_id}</span>
                </div>
                <p className="text-sm text-gray-700">{requirement.description}</p>
              </div>
            </div>
          )}
          {document && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Document</h3>
              <div className="text-sm">
                <span className="font-medium text-gray-600">File: </span>
                <span className="text-gray-900">{document.original_filename}</span>
              </div>
            </div>
          )}
        </div>

        {/* Compliance Status */}
        <div>
          <label htmlFor="compliance_status" className="block text-sm font-medium text-gray-700 mb-2">
            Compliance Status *
          </label>
          <select
            id="compliance_status"
            value={formData.compliance_status}
            onChange={(e) => handleChange('compliance_status', e.target.value)}
            required
            disabled={isSaving}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900"
          >
            <option value="">Select status</option>
            <option value="Compliant">Compliant</option>
            <option value="Non-compliant">Non-compliant</option>
            <option value="Partial">Partial</option>
            <option value="Requires Clarification">Requires Clarification</option>
          </select>
        </div>

        {/* Spec Reference */}
        <div>
          <label htmlFor="spec_reference" className="block text-sm font-medium text-gray-700 mb-2">
            Specification Reference
          </label>
          <input
            type="text"
            id="spec_reference"
            value={formData.spec_reference}
            onChange={(e) => handleChange('spec_reference', e.target.value)}
            disabled={isSaving}
            placeholder="e.g., Section 3.2, Page 15"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900"
          />
        </div>

        {/* Supplier Response */}
        <div>
          <label htmlFor="supplier_response" className="block text-sm font-medium text-gray-700 mb-2">
            Supplier Response
          </label>
          <textarea
            id="supplier_response"
            value={formData.supplier_response}
            onChange={(e) => handleChange('supplier_response', e.target.value)}
            disabled={isSaving}
            rows={4}
            placeholder="How the supplier addresses this requirement..."
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900"
          />
        </div>

        {/* Justification */}
        <div>
          <label htmlFor="justification" className="block text-sm font-medium text-gray-700 mb-2">
            Justification
          </label>
          <textarea
            id="justification"
            value={formData.justification}
            onChange={(e) => handleChange('justification', e.target.value)}
            disabled={isSaving}
            rows={4}
            placeholder="Technical justification for the compliance status..."
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900"
          />
        </div>

        {/* Test Reference */}
        <div>
          <label htmlFor="test_reference" className="block text-sm font-medium text-gray-700 mb-2">
            Test Reference
          </label>
          <input
            type="text"
            id="test_reference"
            value={formData.test_reference}
            onChange={(e) => handleChange('test_reference', e.target.value)}
            disabled={isSaving}
            placeholder="e.g., Test Plan TP-001, IQ Protocol"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900"
          />
        </div>

        {/* Risk Assessment */}
        <div>
          <label htmlFor="risk_assessment" className="block text-sm font-medium text-gray-700 mb-2">
            Risk Assessment
          </label>
          <textarea
            id="risk_assessment"
            value={formData.risk_assessment}
            onChange={(e) => handleChange('risk_assessment', e.target.value)}
            disabled={isSaving}
            rows={3}
            placeholder="Risk level and assessment details..."
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900"
          />
        </div>

        {/* Comments */}
        <div>
          <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-2">
            Comments
          </label>
          <textarea
            id="comments"
            value={formData.comments}
            onChange={(e) => handleChange('comments', e.target.value)}
            disabled={isSaving}
            rows={3}
            placeholder="Additional notes or observations..."
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            isLoading={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

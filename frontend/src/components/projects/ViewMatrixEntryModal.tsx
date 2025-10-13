import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';

interface ViewMatrixEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: MatrixEntry | null;
  requirement: Requirement | null;
  document: Document | null;
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
  priority: string;
  status: string;
}

interface Document {
  id: number;
  original_filename: string;
}

export default function ViewMatrixEntryModal({
  isOpen,
  onClose,
  entry,
  requirement,
  document
}: ViewMatrixEntryModalProps) {
  if (!entry) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getComplianceBadgeColor = (status: string | null) => {
    switch (status) {
      case 'Compliant':
        return 'bg-green-100 text-green-800';
      case 'Non-compliant':
        return 'bg-red-100 text-red-800';
      case 'Partial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getReviewBadgeColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'reviewed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="View Matrix Entry"
      size="xl"
    >
      <div className="space-y-6">
        {/* Requirement and Document Info */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          {requirement && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Requirement</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-gray-600">ID: </span>
                  <span className="text-sm text-gray-900">{requirement.requirement_id}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Description: </span>
                  <p className="text-sm text-gray-900 mt-1">{requirement.description}</p>
                </div>
                {requirement.category && (
                  <div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                      {requirement.category}
                    </span>
                  </div>
                )}
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Compliance Status</label>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getComplianceBadgeColor(entry.compliance_status)}`}>
            {entry.compliance_status || 'N/A'}
          </span>
        </div>

        {/* Spec Reference */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Specification Reference</label>
          <p className="text-sm text-gray-900 bg-gray-50 rounded-md p-3">
            {entry.spec_reference || 'Not specified'}
          </p>
        </div>

        {/* Supplier Response */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Response</label>
          <p className="text-sm text-gray-900 bg-gray-50 rounded-md p-3 whitespace-pre-wrap">
            {entry.supplier_response || 'Not specified'}
          </p>
        </div>

        {/* Justification */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Justification</label>
          <p className="text-sm text-gray-900 bg-gray-50 rounded-md p-3 whitespace-pre-wrap">
            {entry.justification || 'Not specified'}
          </p>
        </div>

        {/* Test Reference */}
        {entry.test_reference && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Test Reference</label>
            <p className="text-sm text-gray-900 bg-gray-50 rounded-md p-3">
              {entry.test_reference}
            </p>
          </div>
        )}

        {/* Risk Assessment */}
        {entry.risk_assessment && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Risk Assessment</label>
            <p className="text-sm text-gray-900 bg-gray-50 rounded-md p-3 whitespace-pre-wrap">
              {entry.risk_assessment}
            </p>
          </div>
        )}

        {/* Comments */}
        {entry.comments && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Comments</label>
            <p className="text-sm text-gray-900 bg-gray-50 rounded-md p-3 whitespace-pre-wrap">
              {entry.comments}
            </p>
          </div>
        )}

        {/* Review Information */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Review Information</h3>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-600">Review Status: </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getReviewBadgeColor(entry.review_status)}`}>
                {entry.review_status.charAt(0).toUpperCase() + entry.review_status.slice(1)}
              </span>
            </div>
            {entry.reviewer_comments && (
              <div>
                <span className="text-sm font-medium text-gray-600">Reviewer Comments:</span>
                <p className="text-sm text-gray-900 mt-1 bg-gray-50 rounded-md p-3">
                  {entry.reviewer_comments}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Generation Metadata */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Generation Information</h3>
          <div className="space-y-2 text-sm text-gray-600">
            {entry.generation_model && (
              <div>
                <span className="font-medium">Model: </span>
                <span className="text-gray-900">{entry.generation_model}</span>
              </div>
            )}
            <div>
              <span className="font-medium">Generated: </span>
              <span className="text-gray-900">{formatDate(entry.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

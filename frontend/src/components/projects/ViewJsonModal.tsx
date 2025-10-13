import { useState } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';

interface ViewJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentName: string;
  extractedJson: any;
}

export default function ViewJsonModal({
  isOpen,
  onClose,
  documentName,
  extractedJson
}: ViewJsonModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  if (!extractedJson) {
    return null;
  }

  // Format JSON with syntax highlighting (simple approach using CSS classes)
  const formatJson = (obj: any, indent = 0): JSX.Element[] => {
    const elements: JSX.Element[] = [];
    const indentStr = '  '.repeat(indent);

    if (Array.isArray(obj)) {
      elements.push(<div key="array-start">{indentStr}[</div>);
      obj.forEach((item, index) => {
        elements.push(...formatJson(item, indent + 1));
        if (index < obj.length - 1) {
          elements.push(<span key={`comma-${index}`}>,</span>);
        }
      });
      elements.push(<div key="array-end">{indentStr}]</div>);
    } else if (typeof obj === 'object' && obj !== null) {
      elements.push(<div key="obj-start">{indentStr}{'{'}</div>);
      const keys = Object.keys(obj);
      keys.forEach((key, index) => {
        const value = obj[key];
        elements.push(
          <div key={`key-${key}`} className="ml-4">
            <span className="text-purple-600">"{key}"</span>
            <span className="text-gray-600">: </span>
            {typeof value === 'object' ? (
              <span>{formatJson(value, indent + 1)}</span>
            ) : typeof value === 'string' ? (
              <span className="text-green-600">"{value}"</span>
            ) : typeof value === 'number' ? (
              <span className="text-blue-600">{value}</span>
            ) : typeof value === 'boolean' ? (
              <span className="text-orange-600">{value.toString()}</span>
            ) : (
              <span className="text-gray-500">null</span>
            )}
            {index < keys.length - 1 && <span>,</span>}
          </div>
        );
      });
      elements.push(<div key="obj-end">{indentStr}{'}'}</div>);
    } else if (typeof obj === 'string') {
      elements.push(<span key="string" className="text-green-600">"{obj}"</span>);
    } else if (typeof obj === 'number') {
      elements.push(<span key="number" className="text-blue-600">{obj}</span>);
    } else if (typeof obj === 'boolean') {
      elements.push(<span key="boolean" className="text-orange-600">{obj.toString()}</span>);
    } else {
      elements.push(<span key="null" className="text-gray-500">null</span>);
    }

    return elements;
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(extractedJson, null, 2));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownloadJson = () => {
    const jsonString = JSON.stringify(extractedJson, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentName.replace(/\.[^/.]+$/, '')}_extracted.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Extract warnings and metadata if they exist
  const warnings = extractedJson.extraction_quality_warnings || [];
  const metadata = extractedJson.extraction_metadata || {};

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Extracted JSON - ${documentName}`}
      size="xl"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Extraction Quality Warnings */}
        {warnings.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-yellow-400 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Extraction Quality Warnings
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc list-inside space-y-1">
                    {warnings.map((warning: string, index: number) => (
                      <li key={index}>{warning.replace(/^⚠️\s*/, '')}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Extraction Metadata */}
        {Object.keys(metadata).length > 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-blue-400 text-xl">📊</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Extraction Metadata
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {metadata.model && (
                      <>
                        <dt className="font-medium">Model:</dt>
                        <dd>{metadata.model}</dd>
                      </>
                    )}
                    {metadata.temperature !== undefined && (
                      <>
                        <dt className="font-medium">Temperature:</dt>
                        <dd>{metadata.temperature} (deterministic)</dd>
                      </>
                    )}
                    {metadata.json_mode !== undefined && (
                      <>
                        <dt className="font-medium">JSON Mode:</dt>
                        <dd>{metadata.json_mode ? 'Enabled' : 'Disabled'}</dd>
                      </>
                    )}
                    {metadata.filename && (
                      <>
                        <dt className="font-medium">Filename:</dt>
                        <dd className="truncate">{metadata.filename}</dd>
                      </>
                    )}
                  </dl>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={handleCopyToClipboard}
            className="flex items-center space-x-2"
          >
            <span>{copySuccess ? '✓ Copied!' : '📋 Copy JSON'}</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadJson}
            className="flex items-center space-x-2"
          >
            <span>💾 Download JSON</span>
          </Button>
        </div>

        {/* Search Box */}
        <div>
          <input
            type="text"
            placeholder="Search in JSON..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pharma-500"
          />
        </div>

        {/* JSON Display */}
        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <pre className="text-sm font-mono">
            {JSON.stringify(extractedJson, null, 2)}
          </pre>
        </div>

        {/* Manual Review Notice */}
        {extractedJson.manual_review_recommended && (
          <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-orange-400 text-xl">👁️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-orange-800">
                  Manual Review Recommended
                </h3>
                <div className="mt-2 text-sm text-orange-700">
                  <p>
                    For GxP compliance, please verify that extracted content matches the original
                    document by performing spot-checks on critical specifications.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

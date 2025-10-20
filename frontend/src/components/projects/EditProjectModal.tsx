import { useState, useEffect } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import { API_V1_URL } from '@/config/api';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  project: {
    id: number;
    name: string;
    description: string;
    status: string;
  };
}

export default function EditProjectModal({ isOpen, onClose, onSuccess, project }: EditProjectModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || '',
    status: project.status,
  });

  // Update form when project changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: project.name,
        description: project.description || '',
        status: project.status,
      });
      setError(null);
    }
  }, [isOpen, project]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_V1_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update project');
      }

      const data = await response.json();
      console.log('Project updated:', data);

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();
    } catch (error) {
      console.error('Error updating project:', error);
      setError(error instanceof Error ? error.message : 'Failed to update project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Project"
      size="md"
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

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900"
            placeholder="Enter project name"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={formData.description}
            onChange={handleChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900"
            placeholder="Enter project description"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900"
            disabled={isSubmitting}
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Change the project status based on its progress
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

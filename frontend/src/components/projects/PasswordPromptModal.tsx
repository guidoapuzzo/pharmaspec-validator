import { useState } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import { API_V1_URL } from '@/config/api';

interface PasswordPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  projectName?: string;
}

export default function PasswordPromptModal({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  projectName
}: PasswordPromptModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_V1_URL}/projects/${projectId}/verify-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to verify password' }));
        throw new Error(errorData.detail || 'Incorrect password');
      }

      // Success - reset and close
      setPassword('');
      setShowPassword(false);
      setError(null);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error verifying password:', error);
      setError(error instanceof Error ? error.message : 'Failed to verify password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setPassword('');
      setShowPassword(false);
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Password Required${projectName ? ` - ${projectName}` : ''}`}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-md bg-blue-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-blue-400">🔒</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Protected Project</h3>
              <div className="mt-2 text-sm text-blue-700">
                This project is password protected. Please enter the password to access it.
              </div>
            </div>
          </div>
        </div>

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
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Project Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900 pr-10"
              placeholder="Enter password"
              disabled={isSubmitting}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              tabIndex={-1}
              disabled={isSubmitting}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={isSubmitting || !password.trim()}
          >
            Verify
          </Button>
        </div>
      </form>
    </Modal>
  );
}

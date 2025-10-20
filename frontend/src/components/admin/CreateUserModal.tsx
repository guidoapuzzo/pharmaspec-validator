import { useState } from 'react';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import { API_V1_URL } from '@/config/api';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateUserModal({ isOpen, onClose, onSuccess }: CreateUserModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'engineer',
    is_active: true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    if (!formData.full_name.trim()) {
      setError('Full name is required');
      return;
    }

    if (!formData.password.trim()) {
      setError('Password is required');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_V1_URL}/users/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create user');
      }

      const data = await response.json();
      console.log('User created:', data);

      // Reset form
      setFormData({
        email: '',
        full_name: '',
        password: '',
        role: 'engineer',
        is_active: true,
      });
      setShowPassword(false);

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();
    } catch (error) {
      console.error('Error creating user:', error);
      setError(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form on close
    setFormData({
      email: '',
      full_name: '',
      password: '',
      role: 'engineer',
      is_active: true,
    });
    setError(null);
    setShowPassword(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New User"
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
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900"
            placeholder="engineer@company.com"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="full_name"
            name="full_name"
            required
            value={formData.full_name}
            onChange={handleChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900"
            placeholder="John Doe"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900 pr-10"
              placeholder="Minimum 8 characters"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Must be at least 8 characters long
          </p>
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-pharma-500 focus:ring-pharma-500 sm:text-sm px-3 py-2 border text-gray-900"
            disabled={isSubmitting}
          >
            <option value="engineer">Engineer</option>
            <option value="admin">Administrator</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Engineers can create and manage projects. Admins have read-only access and can manage users.
          </p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            checked={formData.is_active}
            onChange={handleChange}
            className="h-4 w-4 text-pharma-600 focus:ring-pharma-500 border-gray-300 rounded"
            disabled={isSubmitting}
          />
          <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
            Active (user can log in immediately)
          </label>
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
            disabled={isSubmitting}
          >
            Create User
          </Button>
        </div>
      </form>
    </Modal>
  );
}

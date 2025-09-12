import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, usePermissions } from '@/hooks/useAuth';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { isAdmin } = usePermissions();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Projects', href: '/dashboard', icon: '📁' },
    ...(isAdmin ? [{ name: 'Audit Trail', href: '/audit', icon: '📋' }] : []),
  ];

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link to="/dashboard" className="text-xl font-bold text-pharma-600">
                  PharmaSpec Validator
                </Link>
              </div>

              {/* Navigation Links */}
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive(item.href)
                        ? 'border-pharma-500 text-pharma-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* User Menu */}
            <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
              {/* User Info */}
              <div className="text-sm text-gray-700">
                <span className="font-medium">{user?.full_name}</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  user?.role === 'admin' 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {user?.role}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="sm:hidden flex items-center">
              <button
                type="button"
                className="bg-white inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                aria-expanded="false"
              >
                <span className="sr-only">Open main menu</span>
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              © 2024 PharmaSpec Validator - GxP Compliant CSV Solution
            </div>
            <div className="flex space-x-4">
              <span>Version 1.0.0</span>
              {isAdmin && (
                <Link to="/audit" className="hover:text-gray-700">
                  Audit Trail
                </Link>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
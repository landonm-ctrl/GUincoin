import { ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { logout } from '../services/api';

interface LayoutProps {
  children: ReactNode;
  user?: {
    name: string;
    isManager: boolean;
  };
}

export default function Layout({ children, user }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login');
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const getLinkClasses = (path: string) => {
    const baseClasses = "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium";
    if (isActive(path)) {
      return `${baseClasses} border-blue-500 text-gray-900`;
    }
    return `${baseClasses} border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/dashboard" className="flex items-center px-2 py-2 text-xl font-bold text-blue-600">
                Guincoin
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/dashboard"
                  className={getLinkClasses('/dashboard')}
                >
                  Dashboard
                </Link>
                <Link
                  to="/transfers"
                  className={getLinkClasses('/transfers')}
                >
                  Transfers
                </Link>
                <Link
                  to="/store"
                  className={getLinkClasses('/store')}
                >
                  Store
                </Link>
                <Link
                  to="/wellness"
                  className={getLinkClasses('/wellness')}
                >
                  Wellness
                </Link>
                {user?.isManager && (
                  <Link
                    to="/manager"
                    className={getLinkClasses('/manager')}
                  >
                    Manager Portal
                  </Link>
                )}
                <Link
                  to="/admin"
                  className={getLinkClasses('/admin')}
                >
                  Admin
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-700 mr-4">{user?.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

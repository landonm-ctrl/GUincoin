import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../services/api';

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already logged in
    getCurrentUser()
      .then(() => navigate('/dashboard'))
      .catch(() => {
        // Not logged in, show login button
      });
  }, [navigate]);

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Guincoin Rewards
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in with your Google Workspace account
          </p>
        </div>
        <div>
          <button
            onClick={handleGoogleLogin}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}

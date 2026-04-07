import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

export const RequireRole: React.FC<{
  children: React.ReactNode;
  role: 'admin' | 'manager';
}> = ({ children, role }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  if (role === 'admin' && !user.isAdmin) return <Navigate to="/dashboard" replace />;
  if (role === 'manager' && !user.isManager && !user.isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export const RedirectIfAuthenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

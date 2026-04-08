import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { RequireAuth, RequireRole, RedirectIfAuthenticated } from './components/guards/RequireAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ManagerPortal from './pages/ManagerPortal';
import Transfers from './pages/Transfers';
import Wellness from './pages/Wellness';
import AdminPortal from './pages/AdminPortal';
import Store from './pages/Store';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<RedirectIfAuthenticated><Login /></RedirectIfAuthenticated>} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/manager" element={<RequireRole role="manager"><ManagerPortal /></RequireRole>} />
            <Route path="/transfers" element={<RequireAuth><Transfers /></RequireAuth>} />
            <Route path="/store" element={<RequireAuth><Store /></RequireAuth>} />
            <Route path="/wellness" element={<RequireAuth><Wellness /></RequireAuth>} />
            <Route path="/admin" element={<RequireRole role="admin"><AdminPortal /></RequireRole>} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;

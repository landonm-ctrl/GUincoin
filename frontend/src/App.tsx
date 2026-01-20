import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/manager" element={<ManagerPortal />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/store" element={<Store />} />
          <Route path="/wellness" element={<Wellness />} />
          <Route path="/admin" element={<AdminPortal />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;

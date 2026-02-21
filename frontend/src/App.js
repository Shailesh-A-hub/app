import React from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from '@/contexts/AppContext';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import CommandCenter from '@/pages/CommandCenter';
import WarRoom from '@/pages/WarRoom';
import EvidenceLocker from '@/pages/EvidenceLocker';
import Mailbox from '@/pages/Mailbox';
import AttackVector from '@/pages/AttackVector';
import Customers from '@/pages/Customers';
import ReportsSent from '@/pages/ReportsSent';
import SettingsPage from '@/pages/Settings';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useApp();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { isAuthenticated } = useApp();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><CommandCenter /></ProtectedRoute>} />
      <Route path="/war-room" element={<ProtectedRoute><WarRoom /></ProtectedRoute>} />
      <Route path="/evidence" element={<ProtectedRoute><EvidenceLocker /></ProtectedRoute>} />
      <Route path="/mailbox" element={<ProtectedRoute><Mailbox /></ProtectedRoute>} />
      <Route path="/attack-vector" element={<ProtectedRoute><AttackVector /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsSent /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;

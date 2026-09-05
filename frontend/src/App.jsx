import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Playground from './pages/Playground';
import Admin from './pages/Admin';
import AdminDashboard from './pages/AdminDashboard';
import DatabaseManagement from './pages/DatabaseManagement';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/admin" element={<Admin />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="database" element={<DatabaseManagement />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

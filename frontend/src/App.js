import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';
import LoginPage from './components/LoginPage';
import MapView from './components/MapView';  // ✅ Added MapView route
import Navigation from './components/Navigation';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';
import ReservationDetails from './pages/ReservationDetails';
import MyReservations from "./pages/MyReservations";
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          {/* ✅ Toast notifications */}
          <Toaster
  position="top-right"
  toastOptions={{
    duration: 4000,
    style: { 
      background: '#fff', 
      color: '#333', 
      borderRadius: '8px', 
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
    },
    success: {
      iconTheme: {
        primary: '#4ade80',
        secondary: '#fff',
      },
    },
  }}
  containerStyle={{
    top: 80,
  }}
  reverseOrder={false}
/>

          

          {/* ✅ Main App Routing */}
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!user) {
    // Unauthenticated users → login only
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // ✅ Authenticated routes (Dashboard, Map, Reservation) stay under one layout
  return (
    <>
      {window.location.pathname !== '/map' && <Navigation />}

      <Routes>
        <Route path="/" element={<UserDashboard />} />
        <Route path="/reservation/:id" element={<ReservationDetails />} />
        <Route path="/admin" element={user.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" replace />} />
        <Route path="/map" element={<MapView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/my-reservations" element={user ? <MyReservations /> : <Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}


export default App;

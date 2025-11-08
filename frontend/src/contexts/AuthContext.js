import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate user authentication check
    const checkAuth = async () => {
      try {
        // In a real app, you'd check for a valid token
        const token = localStorage.getItem('token');
        if (token) {
          // Mock user data
          setUser({
            id: 'user_001',
            name: 'John Doe',
            email: 'john@example.com',
            role: 'user'
          });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      // Mock login - in real app, call your auth API
      if (email === 'admin@parking.com' && password === 'admin123') {
        const userData = {
          id: 'admin_001',
          name: 'Admin User',
          email: email,
          role: 'admin'
        };
        setUser(userData);
        localStorage.setItem('token', 'mock_token');
        return { success: true };
      } else if (email === 'user@parking.com' && password === 'user123') {
        const userData = {
          id: 'user_001',
          name: 'John Doe',
          email: email,
          role: 'user'
        };
        setUser(userData);
        localStorage.setItem('token', 'mock_token');
        return { success: true };
      } else {
        return { success: false, error: 'Invalid credentials' };
      }
    } catch (error) {
      return { success: false, error: 'Login failed' };
    }
  };

 const logout = () => {
  // Clear user
  setUser(null);
  // Remove saved auth info
  localStorage.removeItem("user");
  // 🧹 Clear all reservation and location data
  localStorage.removeItem("reservations");
  localStorage.removeItem("history");
  localStorage.removeItem("selectedLot");
  localStorage.removeItem("destination");
  localStorage.removeItem("currentLocation");
  // Redirect to homepage or login
  window.location.href = "/login";
};


  const value = {
    user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

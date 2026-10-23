import React, { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { MSMEDashboard } from './components/MSMEDashboard';
import { GovtDashboard } from './components/GovtDashboard';
import { UserRole, MSMEProfile, GovtProfile } from './types';
import { MOCK_MSME_PROFILE, MOCK_GOVT_PROFILE } from './data/mockData';
import { ThemeProvider } from './context/ThemeContext';

function AppContent() {
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/msme')) return 'msme';
    if (path.startsWith('/govt')) return 'govt';
    return null;
  });

  const [msmeProfile, setMsmeProfile] = useState<MSMEProfile>(MOCK_MSME_PROFILE);
  const [govtProfile, setGovtProfile] = useState<GovtProfile>(MOCK_GOVT_PROFILE);

  // Sync route on popstate (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentRoute(path);
      if (path.startsWith('/msme')) {
        setCurrentUserRole('msme');
      } else if (path.startsWith('/govt')) {
        setCurrentUserRole('govt');
      } else {
        setCurrentUserRole(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string, role?: UserRole | null) => {
    window.history.pushState({}, '', path);
    setCurrentRoute(path);
    if (role !== undefined) {
      setCurrentUserRole(role);
    }
  };

  const handleLogin = (role: UserRole, credentials: any) => {
    if (role === 'msme') {
      if (credentials.udyamNumber) {
        setMsmeProfile(prev => ({
          ...prev,
          udyamNumber: credentials.udyamNumber,
          gstin: credentials.gstin || prev.gstin,
        }));
      }
      navigateTo('/msme/dashboard', 'msme');
    } else {
      if (credentials.officerId) {
        setGovtProfile(prev => ({
          ...prev,
          officerId: credentials.officerId,
          department: credentials.department || prev.department,
        }));
      }
      navigateTo('/govt/dashboard', 'govt');
    }
  };

  const handleLogout = () => {
    navigateTo('/', null);
  };

  // Render appropriate view based on route or logged in state
  if (currentUserRole === 'msme' || currentRoute.startsWith('/msme')) {
    return <MSMEDashboard profile={msmeProfile} onLogout={handleLogout} />;
  }

  if (currentUserRole === 'govt' || currentRoute.startsWith('/govt')) {
    return <GovtDashboard profile={govtProfile} onLogout={handleLogout} />;
  }

  return <LoginPage onLogin={handleLogin} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

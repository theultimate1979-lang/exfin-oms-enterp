import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './views/Login';
import { Dashboard } from './views/Dashboard';
import { Employees } from './views/Employees';
import { Attendance } from './views/Attendance';
import { LeaveManagement } from './views/LeaveManagement';
import { Holidays } from './views/Holidays';
import { Reports } from './views/Reports';
import { Notifications } from './views/Notifications';
import { Settings } from './views/Settings';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, profile, employeeProfile, loading, logout } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
          <p className="text-slate-500 font-semibold text-sm">Authenticating enterprise session...</p>
        </div>
      </div>
    );
  }

  // If unauthorized, direct user to Portal Login
  if (!user) {
    return <Login />;
  }

  // Authorize layout
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      
      {/* Sidebar Wrapper with Mobile Slide Out */}
      <div className={`fixed inset-y-0 left-0 z-50 md:relative md:flex flex-shrink-0 transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <Sidebar 
          currentView={currentView}
          onViewChange={(v) => {
            setCurrentView(v);
            setSidebarOpen(false); // Close mobile tray on click
          }}
          userRole={profile?.role}
          employeeName={employeeProfile ? `${employeeProfile.firstName} ${employeeProfile.lastName}` : (user.email || 'System User')}
          onLogout={logout}
          unreadCount={unreadCount}
        />
      </div>

      {/* Mobile Sidebar Overlay backdrop */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm md:hidden"
        ></div>
      )}

      {/* Main Content Workspace viewport */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Workspace Top Header Bar */}
        <Header 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          userRole={profile?.role}
          employeeName={employeeProfile ? `${employeeProfile.firstName} ${employeeProfile.lastName}` : (user.email || 'System User')}
          onLogout={logout}
          unreadNotificationsCount={unreadCount}
          onNotificationsClick={() => setCurrentView('notifications')}
        />

        {/* View Router Main stage */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {currentView === 'dashboard' && (
              <Dashboard onViewChange={setCurrentView} setUnreadCount={setUnreadCount} />
            )}
            {currentView === 'employees' && (
              <Employees />
            )}
            {currentView === 'attendance' && (
              <Attendance />
            )}
            {currentView === 'leave' && (
              <LeaveManagement />
            )}
            {currentView === 'holidays' && (
              <Holidays />
            )}
            {currentView === 'reports' && (
              <Reports />
            )}
            {currentView === 'notifications' && (
              <Notifications setUnreadCount={setUnreadCount} />
            )}
            {currentView === 'settings' && (
              <Settings />
            )}
          </div>
        </main>

      </div>

    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}

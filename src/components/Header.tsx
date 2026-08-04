import React, { useState, useEffect } from 'react';
import { Menu, Bell, User, ChevronDown, CalendarDays, HelpCircle } from 'lucide-react';
import { UserRole } from '../types';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  userRole: UserRole | undefined;
  employeeName: string;
  onLogout: () => void;
  unreadNotificationsCount: number;
  onNotificationsClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sidebarOpen,
  setSidebarOpen,
  userRole,
  employeeName,
  onLogout,
  unreadNotificationsCount,
  onNotificationsClick
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const formattedDate = time.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-6 py-4 flex items-center justify-between shadow-sm">
      {/* Sidebar Mobile Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors md:hidden"
          aria-label="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        {/* Date Time Display */}
        <div className="hidden sm:flex items-center gap-2 text-slate-500 text-sm font-medium">
          <CalendarDays className="w-4 h-4 text-indigo-500" />
          <span>{formattedDate}</span>
          <span className="text-slate-300">|</span>
          <span className="font-mono text-indigo-600">{formattedTime}</span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          onClick={onNotificationsClick}
          className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
          aria-label="View notifications"
        >
          <Bell className="w-5 h-5 text-slate-600" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 bg-rose-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center animate-pulse">
              {unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* User Dropdown */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shadow-sm">
            {employeeName ? employeeName.charAt(0) : 'U'}
          </div>
          <div className="hidden md:block text-left leading-tight">
            <p className="text-sm font-semibold text-slate-800">{employeeName || 'System User'}</p>
            <p className="text-xs text-slate-400 font-medium capitalize">{userRole?.toLowerCase() || 'Employee'}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

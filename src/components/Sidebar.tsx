import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  CalendarDays, 
  Calendar, 
  BarChart3, 
  Bell, 
  LogOut, 
  Building2,
  Settings
} from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  userRole: UserRole | undefined;
  employeeName: string;
  onLogout: () => void;
  unreadCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  userRole,
  employeeName,
  onLogout,
  unreadCount
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Super Admin', 'HR Admin', 'Manager', 'Employee'] },
    { id: 'employees', label: 'Employees', icon: Users, roles: ['Super Admin', 'HR Admin', 'Manager', 'Employee'] },
    { id: 'attendance', label: 'Attendance', icon: Clock, roles: ['Super Admin', 'HR Admin', 'Manager', 'Employee'] },
    { id: 'leave', label: 'Leave Management', icon: CalendarDays, roles: ['Super Admin', 'HR Admin', 'Manager', 'Employee'] },
    { id: 'holidays', label: 'Holiday Calendar', icon: Calendar, roles: ['Super Admin', 'HR Admin', 'Manager', 'Employee'] },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, roles: ['Super Admin', 'HR Admin', 'Manager', 'Employee'] },
    { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['Super Admin', 'HR Admin', 'Manager', 'Employee'], badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['Super Admin', 'HR Admin', 'Manager', 'Employee'] },
  ];

  const filteredItems = menuItems.filter(item => 
    !userRole || item.roles.includes(userRole)
  );

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 min-h-screen">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-lg text-white">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight leading-none text-white">EXFIN OMS</h1>
          <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Enterprise</span>
        </div>
      </div>

      {/* User Quick Info */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40">
        <p className="text-xs text-slate-400">Signed in as</p>
        <p className="font-semibold text-slate-100 truncate">{employeeName || 'System User'}</p>
        <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          {userRole || 'Employee'}
        </span>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/20">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

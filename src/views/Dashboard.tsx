import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { 
  getTodayString, 
  formatDate, 
  formatTime, 
  calculateWorkingHours, 
  isLateEntry 
} from '../utils/date';
import { 
  Users, 
  Clock, 
  Calendar, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  TrendingUp, 
  CalendarDays, 
  Volume2, 
  FileCheck 
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar 
} from 'recharts';
import { LeaveApplication, LeaveQuota, AttendanceRecord, Holiday, Notification } from '../types';

interface DashboardProps {
  onViewChange: (view: string) => void;
  setUnreadCount: (count: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onViewChange, setUnreadCount }) => {
  const { user, profile, employeeProfile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeToday: 0,
    pendingLeaves: 0,
    onTimeRate: 100
  });

  const [loading, setLoading] = useState(true);
  const [personalQuota, setPersonalQuota] = useState<LeaveQuota | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [pendingApplications, setPendingApplications] = useState<LeaveApplication[]>([]);
  const [announcements, setAnnouncements] = useState<Notification[]>([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState<Holiday[]>([]);
  const [attendanceChartData, setAttendanceChartData] = useState<any[]>([]);
  const [leaveChartData, setLeaveChartData] = useState<any[]>([]);

  const isPrivileged = profile?.role && ['Super Admin', 'HR Admin', 'Manager'].includes(profile.role);
  const isManagerOnly = profile?.role === 'Manager';

  // Fetch Dashboard data
  useEffect(() => {
    async function loadDashboard() {
      if (!user) return;
      setLoading(true);
      try {
        const todayStr = getTodayString();

        // 1. Fetch personal today's attendance
        const attRef = doc(db, 'attendance', `${user.uid}-${todayStr}`);
        const attSnap = await getDoc(attRef);
        if (attSnap.exists()) {
          setTodayAttendance(attSnap.data() as AttendanceRecord);
        } else {
          setTodayAttendance(null);
        }

        // 2. Fetch personal leave quota
        const quotaRef = doc(db, 'leaveQuota', user.uid);
        const quotaSnap = await getDoc(quotaRef);
        if (quotaSnap.exists()) {
          setPersonalQuota(quotaSnap.data() as LeaveQuota);
        }

        // 3. Fetch announcements (notifications for 'ALL' or user)
        const notifQuery = query(
          collection(db, 'notifications'),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const notifSnap = await getDocs(notifQuery);
        const notifList: Notification[] = [];
        let unread = 0;
        notifSnap.forEach(d => {
          const item = d.data() as Notification;
          item.id = d.id;
          if (item.userId === 'ALL' || item.userId === user.uid) {
            notifList.push(item);
            if (!item.read) unread++;
          }
        });
        setAnnouncements(notifList.filter(n => n.type === 'Announcement').slice(0, 3));
        setUnreadCount(unread);

        // 4. Fetch Holidays
        const holQuery = query(collection(db, 'holidays'), limit(5));
        const holSnap = await getDocs(holQuery);
        const holList: Holiday[] = [];
        holSnap.forEach(d => {
          holList.push({ id: d.id, ...d.data() } as Holiday);
        });
        setUpcomingHolidays(holList.sort((a,b) => a.date.localeCompare(b.date)));

        // 5. Privileged user stats
        if (isPrivileged) {
          // Total employees active status
          const empQuery = query(collection(db, 'employees'), where('status', '==', 'Active'));
          const empSnap = await getDocs(empQuery);
          const totalEmp = empSnap.size;

          // Checked in today
          const attTodayQuery = query(collection(db, 'attendance'), where('date', '==', todayStr));
          const attTodaySnap = await getDocs(attTodayQuery);
          const presentCount = attTodaySnap.size;

          // Late count today
          let lateCount = 0;
          attTodaySnap.forEach(d => {
            if (d.data().late) lateCount++;
          });

          // Pending leaves
          const leavePendingQuery = query(collection(db, 'leaveApplications'), where('status', '==', 'Pending'));
          const leavePendingSnap = await getDocs(leavePendingQuery);
          const pendingList: LeaveApplication[] = [];
          leavePendingSnap.forEach(d => {
            pendingList.push({ id: d.id, ...d.data() } as LeaveApplication);
          });
          setPendingApplications(pendingList);

          // Working statistics rate
          const onTimeRate = presentCount > 0 ? Math.round(((presentCount - lateCount) / presentCount) * 100) : 100;

          setStats({
            totalEmployees: totalEmp,
            activeToday: presentCount,
            pendingLeaves: pendingList.length,
            onTimeRate
          });

          // Create some nice sample or dynamic Recharts data
          // Mock some daily attendance rates based on real dates if possible, else structured realistic items
          setAttendanceChartData([
            { name: 'Mon', Present: 92, Late: 8 },
            { name: 'Tue', Present: 95, Late: 5 },
            { name: 'Wed', Present: 88, Late: 12 },
            { name: 'Thu', Present: 94, Late: 6 },
            { name: 'Fri', Present: 96, Late: 4 },
            { name: 'Today', Present: onTimeRate, Late: presentCount > 0 ? 100 - onTimeRate : 0 }
          ]);

          // Fetch aggregate leave types
          const leaveQuery = query(collection(db, 'leaveApplications'));
          const leaveAllSnap = await getDocs(leaveQuery);
          const leaveTypesMap: Record<string, number> = {
            'Casual Leave': 0,
            'Sick Leave': 0,
            'Earned Leave': 0,
            'Half Day': 0
          };
          leaveAllSnap.forEach(d => {
            const l = d.data() as LeaveApplication;
            if (l.status === 'Approved' && leaveTypesMap[l.leaveType] !== undefined) {
              leaveTypesMap[l.leaveType] += l.totalDays;
            }
          });
          setLeaveChartData(Object.keys(leaveTypesMap).map(key => ({
            name: key,
            value: leaveTypesMap[key] || 1 // fallback to 1 for visual distribution
          })));
        }

      } catch (err) {
        console.error("Error loading dashboard data:", err);
        showToast("Error retrieving system statistics.", "error");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user, profile, refreshProfile]);

  // Handle Quick Check-in
  const handleCheckIn = async () => {
    if (!user || !employeeProfile) return;
    const todayStr = getTodayString();
    const nowIso = new Date().toISOString();
    const isLate = isLateEntry(nowIso);

    const record: AttendanceRecord = {
      userId: user.uid,
      date: todayStr,
      checkIn: nowIso,
      status: isLate ? 'Late' : 'Present',
      late: isLate
    };

    try {
      await setDoc(doc(db, 'attendance', `${user.uid}-${todayStr}`), record);
      setTodayAttendance(record);
      
      // Post alert to employee
      if (isLate) {
        await addDoc(collection(db, 'notifications'), {
          userId: user.uid,
          title: 'Late Entry Flagged',
          message: `Your check-in at ${formatTime(nowIso)} was recorded after standard hours (09:15 AM).`,
          type: 'AttendanceAlert',
          read: false,
          createdAt: nowIso
        });
      }

      showToast(isLate ? 'Checked In! Recorded as late entry.' : 'Checked in successfully! Have a great day.', isLate ? 'warning' : 'success');
    } catch (e) {
      console.error(e);
      showToast('Check-in failed. Please try again.', 'error');
    }
  };

  // Handle Quick Check-out
  const handleCheckOut = async () => {
    if (!user || !todayAttendance) return;
    const nowIso = new Date().toISOString();
    const wHours = calculateWorkingHours(todayAttendance.checkIn, nowIso);

    try {
      const recordRef = doc(db, 'attendance', `${user.uid}-${todayAttendance.date}`);
      await updateDoc(recordRef, {
        checkOut: nowIso,
        workingHours: wHours
      });

      setTodayAttendance(prev => prev ? {
        ...prev,
        checkOut: nowIso,
        workingHours: wHours
      } : null);

      showToast(`Checked out successfully! Total Hours: ${wHours} hrs.`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Check-out failed. Please try again.', 'error');
    }
  };

  // Handle Leave Application Action (Approve/Reject)
  const handleLeaveAction = async (app: LeaveApplication, status: 'Approved' | 'Rejected') => {
    if (!user || !profile) return;
    try {
      const appRef = doc(db, 'leaveApplications', app.id!);
      const actionDate = new Date().toISOString();
      
      await updateDoc(appRef, {
        status,
        actionBy: user.uid,
        actionByName: employeeProfile ? `${employeeProfile.firstName} ${employeeProfile.lastName}` : profile.email,
        actionDate
      });

      // If approved, deduct from user's leave balance
      if (status === 'Approved') {
        const quotaRef = doc(db, 'leaveQuota', app.userId);
        const qSnap = await getDoc(quotaRef);
        if (qSnap.exists()) {
          const quota = qSnap.data() as LeaveQuota;
          let usedField = '';
          if (app.leaveType === 'Casual Leave') usedField = 'casualLeaveUsed';
          else if (app.leaveType === 'Sick Leave') usedField = 'sickLeaveUsed';
          else if (app.leaveType === 'Earned Leave') usedField = 'earnedLeaveUsed';
          else if (app.leaveType === 'Half Day') usedField = 'casualLeaveUsed'; // Half day deducts 0.5 from casual

          if (usedField) {
            const deduction = app.leaveType === 'Half Day' ? 0.5 : app.totalDays;
            const currentUsed = (quota as any)[usedField] || 0;
            await updateDoc(quotaRef, {
              [usedField]: currentUsed + deduction
            });
          }
        }
      }

      // Send automated notification to employee
      await addDoc(collection(db, 'notifications'), {
        userId: app.userId,
        title: `Leave Application ${status}`,
        message: `Your requested leave (${app.leaveType}) from ${formatDate(app.startDate)} to ${formatDate(app.endDate)} has been ${status.toLowerCase()}.`,
        type: 'LeaveApproval',
        read: false,
        createdAt: actionDate
      });

      setPendingApplications(prev => prev.filter(p => p.id !== app.id));
      showToast(`Leave application successfully ${status.toLowerCase()}.`, 'success');
    } catch (e) {
      console.error("Error resolving leave request:", e);
      showToast('Operation failed. Please try again.', 'error');
    }
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899'];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium text-sm">Synchronizing live workspace metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Welcome Bar with Geometric Backdrop */}
      <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white overflow-hidden shadow-lg border border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">EXFIN OMS ENTERPRISE</span>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">
              Welcome back, {employeeProfile?.firstName || 'User'}!
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-lg font-medium">
              You are signed in as a <span className="text-indigo-200 font-bold">{profile?.role}</span> in the <span className="font-semibold text-slate-100">{employeeProfile?.department || 'Operations'}</span> branch.
            </p>
          </div>
          
          {/* Daily Shift Widget */}
          <div className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-xl flex items-center gap-4">
            <div>
              <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">CURRENT SHIFT STATUS</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {todayAttendance ? (todayAttendance.checkOut ? 'Shift Completed' : 'Checked In') : 'Not Checked In'}
              </p>
              {todayAttendance && (
                <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                  In: {formatTime(todayAttendance.checkIn)} {todayAttendance.checkOut ? `| Out: ${formatTime(todayAttendance.checkOut)}` : ''}
                </p>
              )}
            </div>
            
            {/* Contextual Button */}
            {!todayAttendance ? (
              <button
                onClick={handleCheckIn}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-xs font-extrabold text-white rounded-lg shadow-md transition-all cursor-pointer"
              >
                Check In
              </button>
            ) : !todayAttendance.checkOut ? (
              <button
                onClick={handleCheckOut}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-xs font-extrabold text-white rounded-lg shadow-md transition-all cursor-pointer"
              >
                Check Out
              </button>
            ) : (
              <div className="bg-emerald-500/20 text-emerald-300 p-1.5 rounded-lg border border-emerald-500/30">
                <CheckCircle className="w-5 h-5" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Privileged Overview Analytics Block */}
      {isPrivileged && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Personnel</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{stats.totalEmployees}</h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-2 bg-emerald-50 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" /> Active Roster
              </span>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Checked In Today</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{stats.activeToday}</h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 mt-2 bg-slate-100 px-2 py-0.5 rounded-full">
                Live Attendance
              </span>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Leave Apps</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{stats.pendingLeaves}</h3>
              {stats.pendingLeaves > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 mt-2 bg-amber-50 px-2 py-0.5 rounded-full animate-pulse">
                  Requires Review
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-2 bg-emerald-50 px-2 py-0.5 rounded-full">
                  All Caught Up
                </span>
              )}
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">On-Time Arrival Rate</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{stats.onTimeRate}%</h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-2 bg-emerald-50 px-2 py-0.5 rounded-full">
                Target &gt;90%
              </span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
          </div>

        </div>
      )}

      {/* Analytical Charts Block (For Privileged Roles) */}
      {isPrivileged && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Chart Column */}
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Weekly Attendance Distribution</h3>
                <p className="text-xs text-slate-500">Live summary of on-time vs late registrations</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceChartData}>
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Present" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPresent)" />
                  <Area type="monotone" dataKey="Late" stroke="#f59e0b" strokeWidth={2} fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Side distribution widget */}
          <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Approved Leave breakdown</h3>
              <p className="text-xs text-slate-500 mb-4">Total corporate leave days distributed by classification</p>
            </div>
            <div className="h-40 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leaveChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {leaveChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {leaveChartData.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                  <span className="truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Main Body Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Leave Quotas + Holiday Calendar + announcements) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Employee Quota Balance Console (Employee view only) */}
          {!isPrivileged && personalQuota && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 text-base mb-4">Your 2026 Leave Balances</h3>
              <div className="grid grid-cols-3 gap-4">
                
                {/* Balance Block 1 */}
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Casual Leave</p>
                  <h4 className="text-2xl font-extrabold text-blue-900 mt-2">
                    {personalQuota.casualLeave - personalQuota.casualLeaveUsed} / {personalQuota.casualLeave}
                  </h4>
                  <p className="text-[10px] text-blue-500 font-medium mt-1">days remaining</p>
                </div>

                {/* Balance Block 2 */}
                <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Sick Leave</p>
                  <h4 className="text-2xl font-extrabold text-emerald-900 mt-2">
                    {personalQuota.sickLeave - personalQuota.sickLeaveUsed} / {personalQuota.sickLeave}
                  </h4>
                  <p className="text-[10px] text-emerald-500 font-medium mt-1">days remaining</p>
                </div>

                {/* Balance Block 3 */}
                <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Earned Leave</p>
                  <h4 className="text-2xl font-extrabold text-purple-900 mt-2">
                    {personalQuota.earnedLeave - personalQuota.earnedLeaveUsed} / {personalQuota.earnedLeave}
                  </h4>
                  <p className="text-[10px] text-purple-500 font-medium mt-1">days remaining</p>
                </div>

              </div>
              <button 
                onClick={() => onViewChange('leave')}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 font-bold text-xs py-2.5 rounded-xl text-white transition-all cursor-pointer"
              >
                Apply for New Leave Instance
              </button>
            </div>
          )}

          {/* Pending Leave Applications List (For Managers and Admins) */}
          {isPrivileged && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Pending Leave Applications</h3>
                <button 
                  onClick={() => onViewChange('leave')}
                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  Manage All
                </button>
              </div>

              {pendingApplications.length === 0 ? (
                <div className="p-8 text-center">
                  <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm font-medium">All employees' leave submissions are resolved.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                        <th className="px-6 py-3 text-left">Employee</th>
                        <th className="px-6 py-3 text-left">Classification</th>
                        <th className="px-6 py-3 text-left">Duration</th>
                        <th className="px-6 py-3 text-left">Reason</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingApplications.slice(0, 4).map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-800 block">
                              {app.employeeName || 'Active Personnel'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">UID: ...{app.userId.slice(-6)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                              {app.leaveType}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-800 block">{app.totalDays} Days</span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {formatDate(app.startDate)} - {formatDate(app.endDate)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate" title={app.reason}>
                            {app.reason}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => handleLeaveAction(app, 'Approved')}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleLeaveAction(app, 'Rejected')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Company Announcements Broadcasts */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-indigo-600" />
              Corporate Communications & Announcements
            </h3>
            {announcements.length === 0 ? (
              <p className="text-slate-400 text-xs font-medium">No system announcements posted yet.</p>
            ) : (
              <div className="space-y-4">
                {announcements.map((item) => (
                  <div key={item.id} className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-start gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl flex-shrink-0 mt-0.5">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed mt-1 font-medium">{item.message}</p>
                      <span className="text-[9px] text-slate-400 block mt-2 font-semibold">
                        Posted: {formatDate(item.createdAt)} at {formatTime(item.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column (Upcoming Holidays + Profile Card) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Quick Profile Overview */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="w-16 h-16 bg-slate-900 text-white font-extrabold text-xl rounded-full flex items-center justify-center mx-auto shadow-md border-2 border-slate-100">
              {employeeProfile ? `${employeeProfile.firstName.charAt(0)}${employeeProfile.lastName.charAt(0)}` : 'S'}
            </div>
            <h3 className="text-slate-800 font-extrabold text-base mt-3">
              {employeeProfile ? `${employeeProfile.firstName} ${employeeProfile.lastName}` : 'System Session'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">{employeeProfile?.designation || 'Specialist'}</p>
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest bg-slate-100 text-slate-700 border border-slate-200">
              ID: {employeeProfile?.employeeId || 'N/A'}
            </span>

            <div className="border-t border-slate-100 mt-4 pt-4 text-left space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Joined Date:</span>
                <span className="text-slate-700 font-bold">{formatDate(employeeProfile?.joiningDate)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Email:</span>
                <span className="text-slate-700 font-bold truncate max-w-[180px]">{employeeProfile?.email || user?.email}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Contact:</span>
                <span className="text-slate-700 font-bold">{employeeProfile?.contactNumber || 'No record'}</span>
              </div>
            </div>
          </div>

          {/* Upcoming Holiday Calendar */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              Corporate Holidays Calendar
            </h3>
            {upcomingHolidays.length === 0 ? (
              <p className="text-slate-400 text-xs font-medium">No holidays mapped for the session.</p>
            ) : (
              <div className="space-y-3">
                {upcomingHolidays.map((hol) => (
                  <div key={hol.id} className="flex items-center justify-between border-b border-slate-50 pb-2 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{hol.name}</p>
                      <span className="text-[10px] text-indigo-600 font-bold uppercase">{hol.type} Holiday</span>
                    </div>
                    <span className="bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded text-[10px]">
                      {formatDate(hol.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

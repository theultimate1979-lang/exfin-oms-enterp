import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where,
  orderBy 
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
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Calendar, 
  Search, 
  Filter, 
  Download, 
  Moon, 
  Sun,
  UserCheck 
} from 'lucide-react';
import { AttendanceRecord, EmployeeProfile } from '../types';
import { motion } from 'motion/react';

export const Attendance: React.FC = () => {
  const { user, profile, employeeProfile } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [personalHistory, setPersonalHistory] = useState<AttendanceRecord[]>([]);
  const [workStartHour, setWorkStartHour] = useState(9);
  const [workStartMinute, setWorkStartMinute] = useState(15);

  // Admin/Manager States
  const [companyAttendance, setCompanyAttendance] = useState<(AttendanceRecord & { employee?: EmployeeProfile })[]>([]);
  const [employeesMap, setEmployeesMap] = useState<Record<string, EmployeeProfile>>({});
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [selectedStatus, setSelectedStatus] = useState('All');

  const isPrivileged = profile?.role && ['Super Admin', 'HR Admin', 'Manager'].includes(profile.role);

  // Fetch Attendance records
  const loadAttendance = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const todayStr = getTodayString();

      // Load Office settings dynamically
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'office'));
        if (settingsSnap.exists()) {
          const sData = settingsSnap.data();
          if (sData.workStartHour !== undefined) setWorkStartHour(sData.workStartHour);
          if (sData.workStartMinute !== undefined) setWorkStartMinute(sData.workStartMinute);
        }
      } catch (err) {
        console.warn("Error loading office dynamic configurations:", err);
      }

      // 1. Fetch employee today record
      const attRef = doc(db, 'attendance', `${user.uid}-${todayStr}`);
      const attSnap = await getDoc(attRef);
      if (attSnap.exists()) {
        setTodayRecord(attSnap.data() as AttendanceRecord);
      } else {
        setTodayRecord(null);
      }

      // 2. Fetch employee personal attendance history
      const personalQuery = query(
        collection(db, 'attendance'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const personalSnap = await getDocs(personalQuery);
      const personalList: AttendanceRecord[] = [];
      personalSnap.forEach(d => {
        personalList.push(d.data() as AttendanceRecord);
      });
      setPersonalHistory(personalList);

      // 3. Fetch collective records for managers/admins
      if (isPrivileged) {
        // Fetch all employees mapped by UID for easy lookups
        const empSnap = await getDocs(collection(db, 'employees'));
        const empMap: Record<string, EmployeeProfile> = {};
        empSnap.forEach(d => {
          empMap[d.id] = d.data() as EmployeeProfile;
        });
        setEmployeesMap(empMap);

        // Fetch attendance logs for selectedDate
        const compQuery = query(
          collection(db, 'attendance'),
          where('date', '==', selectedDate)
        );
        const compSnap = await getDocs(compQuery);
        const compList: (AttendanceRecord & { employee?: EmployeeProfile })[] = [];
        compSnap.forEach(d => {
          const rec = d.data() as AttendanceRecord;
          compList.push({
            ...rec,
            employee: empMap[rec.userId]
          });
        });
        setCompanyAttendance(compList);
      }

    } catch (err) {
      console.error("Attendance query failure:", err);
      showToast('Error synchronizing attendance records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [user, profile, selectedDate]);

  // Handle manual Check-in
  const handleCheckIn = async () => {
    if (!user || !employeeProfile) return;
    const todayStr = getTodayString();
    const nowIso = new Date().toISOString();
    const isLate = isLateEntry(nowIso, workStartHour, workStartMinute);

    const record: AttendanceRecord = {
      userId: user.uid,
      date: todayStr,
      checkIn: nowIso,
      status: isLate ? 'Late' : 'Present',
      late: isLate
    };

    try {
      await setDoc(doc(db, 'attendance', `${user.uid}-${todayStr}`), record);
      setTodayRecord(record);
      
      // Post late-arrival alert if applicable
      if (isLate) {
        const timeLimitStr = `${String(workStartHour).padStart(2, '0')}:${String(workStartMinute).padStart(2, '0')}`;
        await addDoc(collection(db, 'notifications'), {
          userId: user.uid,
          title: 'Late Entry Flagged',
          message: `Your check-in at ${formatTime(nowIso)} was logged past corporate start thresholds (${timeLimitStr} AM/PM).`,
          type: 'AttendanceAlert',
          read: false,
          createdAt: nowIso
        });
      }

      showToast(isLate ? 'Checked In! System flagged a late entry status.' : 'Checked in successfully! Shift started.', isLate ? 'warning' : 'success');
      loadAttendance();
    } catch (e) {
      console.error(e);
      showToast('Attendance operation failed. Please try again.', 'error');
    }
  };

  // Handle manual Check-out
  const handleCheckOut = async () => {
    if (!user || !todayRecord) return;
    const nowIso = new Date().toISOString();
    const wHours = calculateWorkingHours(todayRecord.checkIn, nowIso);

    try {
      const recordRef = doc(db, 'attendance', `${user.uid}-${todayRecord.date}`);
      await updateDoc(recordRef, {
        checkOut: nowIso,
        workingHours: wHours
      });

      setTodayRecord(prev => prev ? {
        ...prev,
        checkOut: nowIso,
        workingHours: wHours
      } : null);

      showToast(`Checked out successfully! Calculated hours: ${wHours} hrs.`, 'success');
      loadAttendance();
    } catch (e) {
      console.error(e);
      showToast('Operation failed. Please try again.', 'error');
    }
  };

  // Export CSV representation of attendance logs
  const handleExportCSV = () => {
    let headers = "Employee Name,Employee ID,Department,Date,Check In,Check Out,Working Hours,Status\n";
    let rows = companyAttendance.map(att => {
      const name = att.employee ? `${att.employee.firstName} ${att.employee.lastName}` : "Anonymous";
      const empId = att.employee?.employeeId || "N/A";
      const dept = att.employee?.department || "Operations";
      return `"${name}","${empId}","${dept}","${att.date}","${formatTime(att.checkIn)}","${att.checkOut ? formatTime(att.checkOut) : 'In Office'}","${att.workingHours || 0}","${att.status}"`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `EXFIN_Attendance_Report_${selectedDate}.csv`);
    a.click();
  };

  const filteredCompanyAttendance = companyAttendance.filter(att => {
    if (selectedStatus === 'All') return true;
    return att.status === selectedStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Shift & Attendance Terminal</h1>
        <p className="text-sm text-slate-500 font-medium">Record work shifts, view historical arrivals, and supervise roster attendance metrics</p>
      </div>

      {/* Grid: Check-in widget (Employee side) & Overview panel (Admin side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Check-In/Out Controller Card */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-3">Live Session Console</h3>
            <p className="text-xs text-slate-500 font-medium">Log your daily entry and exit times. Your records sync in real-time for payroll calculations.</p>
          </div>

          <div className="my-8 text-center">
            {todayRecord ? (
              todayRecord.checkOut ? (
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-800">Shift Completed Today</h4>
                  <p className="text-xs text-slate-500 font-medium">Logged Hours: <span className="font-bold text-slate-900">{todayRecord.workingHours} hrs</span></p>
                </div>
              ) : (
                <div className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-extrabold text-indigo-900">Shift In Progress</h4>
                  <p className="text-[11px] text-indigo-600 font-bold uppercase tracking-wider">Checked In At: {formatTime(todayRecord.checkIn)}</p>
                  <p className="text-xs text-slate-500 font-medium">Don't forget to check out upon shift completion!</p>
                </div>
              )
            ) : (
              <div className="p-6 bg-amber-50/50 border border-amber-100 rounded-2xl space-y-2">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                  <Sun className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-extrabold text-amber-800">No shift started yet</h4>
                <p className="text-xs text-amber-600 font-medium">Standard arrivals end at 09:15 AM.</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            {!todayRecord ? (
              <button
                onClick={handleCheckIn}
                className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white text-xs font-extrabold py-3 rounded-xl transition-all shadow cursor-pointer flex items-center justify-center gap-2"
              >
                <Sun className="w-4 h-4" /> Start Shift Check-In
              </button>
            ) : !todayRecord.checkOut ? (
              <button
                onClick={handleCheckOut}
                className="w-full bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white text-xs font-extrabold py-3 rounded-xl transition-all shadow cursor-pointer flex items-center justify-center gap-2"
              >
                <Moon className="w-4 h-4" /> Complete Shift Check-Out
              </button>
            ) : (
              <button
                disabled
                className="w-full bg-slate-100 text-slate-400 text-xs font-extrabold py-3 rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Today's Shift Logs Recorded
              </button>
            )}
          </div>
        </div>

        {/* Corporate/Personal Lists */}
        <div className="lg:col-span-8">
          
          {/* Admin Portal Roster view */}
          {isPrivileged ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col justify-between">
              
              <div>
                {/* Filters Row */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 uppercase">Supervise Date:</span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 uppercase">Status:</span>
                    <select
                      value={selectedStatus}
                      onChange={e => setSelectedStatus(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
                    >
                      <option value="All">All Arrivals</option>
                      <option value="Present">Present</option>
                      <option value="Late">Late Entry</option>
                    </select>

                    <button
                      onClick={handleExportCSV}
                      disabled={filteredCompanyAttendance.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                  </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 font-bold text-[10px] uppercase">
                        <th className="px-6 py-3 text-left">Employee Name</th>
                        <th className="px-6 py-3 text-left">Job Title</th>
                        <th className="px-6 py-3 text-left">Check In</th>
                        <th className="px-6 py-3 text-left">Check Out</th>
                        <th className="px-6 py-3 text-left">Logged Hours</th>
                        <th className="px-6 py-3 text-right">Duty Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCompanyAttendance.map((rec) => (
                        <tr key={rec.userId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-800 block">
                              {rec.employee ? `${rec.employee.firstName} ${rec.employee.lastName}` : 'System Professional'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">ID: {rec.employee?.employeeId || 'N/A'}</span>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-500">
                            {rec.employee?.designation || 'Specialist'}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-700 font-mono">
                            {formatTime(rec.checkIn)}
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-700 font-mono">
                            {rec.checkOut ? formatTime(rec.checkOut) : (
                              <span className="text-indigo-600 font-bold text-[10px] bg-indigo-50 px-2 py-0.5 rounded-full">On Shift</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-800">
                            {rec.workingHours ? `${rec.workingHours} hrs` : 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {rec.status === 'Present' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                                Present
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
                                Late Entry
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {filteredCompanyAttendance.length === 0 && (
                <div className="p-12 text-center">
                  <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-bold text-sm">No arrivals recorded for the chosen query.</p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Ensure employees have checked in on this date.</p>
                </div>
              )}

            </div>
          ) : (
            
            // Employee personal attendance history logs
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Your Duty Log History</h3>
              </div>

              {personalHistory.length === 0 ? (
                <div className="p-12 text-center">
                  <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-pulse" />
                  <p className="text-slate-500 font-medium text-sm">No shifts logged yet on this credential.</p>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[400px]">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50/30 border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                        <th className="px-6 py-3 text-left">Date</th>
                        <th className="px-6 py-3 text-left">Arrival Time</th>
                        <th className="px-6 py-3 text-left">Departure Time</th>
                        <th className="px-6 py-3 text-left">Calculated Hours</th>
                        <th className="px-6 py-3 text-right">Filing Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {personalHistory.map((rec) => (
                        <tr key={rec.date} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-xs font-bold text-slate-800">
                            {formatDate(rec.date)}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-600 font-mono">
                            {formatTime(rec.checkIn)}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-600 font-mono">
                            {rec.checkOut ? formatTime(rec.checkOut) : 'No record'}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-800">
                            {rec.workingHours ? `${rec.workingHours} hrs` : 'Incomplete'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {rec.status === 'Present' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                Present
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">
                                Late Arrival
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

    </div>
  );
};

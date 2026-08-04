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
import { calculateLeaveDays, formatDate } from '../utils/date';
import { 
  Calendar, 
  ClipboardCheck, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Filter, 
  FileText,
  UserPlus 
} from 'lucide-react';
import { LeaveApplication, LeaveQuota } from '../types';
import { motion } from 'motion/react';

export const LeaveManagement: React.FC = () => {
  const { user, profile, employeeProfile } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [personalQuota, setPersonalQuota] = useState<LeaveQuota | null>(null);
  const [personalApplications, setPersonalApplications] = useState<LeaveApplication[]>([]);

  // Admin/Manager States
  const [pendingApplications, setPendingApplications] = useState<LeaveApplication[]>([]);
  const [resolvedApplications, setResolvedApplications] = useState<LeaveApplication[]>([]);
  const [filterType, setFilterType] = useState('All');

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [reason, setReason] = useState('');
  const [applying, setApplying] = useState(false);

  const isPrivileged = profile?.role && ['Super Admin', 'HR Admin', 'Manager'].includes(profile.role);

  // Load all required data
  const loadLeaveData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch personal quota
      const quotaRef = doc(db, 'leaveQuota', user.uid);
      const quotaSnap = await getDoc(quotaRef);
      if (quotaSnap.exists()) {
        setPersonalQuota(quotaSnap.data() as LeaveQuota);
      }

      // 2. Fetch employee's personal leave applications
      const personalQuery = query(
        collection(db, 'leaveApplications'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const personalSnap = await getDocs(personalQuery);
      const personalList: LeaveApplication[] = [];
      personalSnap.forEach(d => {
        personalList.push({ id: d.id, ...d.data() } as LeaveApplication);
      });
      setPersonalApplications(personalList);

      // 3. Fetch collective records for managers/admins
      if (isPrivileged) {
        const allQuery = query(
          collection(db, 'leaveApplications'),
          orderBy('createdAt', 'desc')
        );
        const allSnap = await getDocs(allQuery);
        const pendingList: LeaveApplication[] = [];
        const resolvedList: LeaveApplication[] = [];
        
        allSnap.forEach(d => {
          const app = { id: d.id, ...d.data() } as LeaveApplication;
          if (app.status === 'Pending') {
            pendingList.push(app);
          } else {
            resolvedList.push(app);
          }
        });

        setPendingApplications(pendingList);
        setResolvedApplications(resolvedList);
      }

    } catch (err) {
      console.error("Leave query error:", err);
      showToast('Error syncing leave allocations database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaveData();
  }, [user, profile]);

  // Handle Leave Submission
  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !employeeProfile || !personalQuota) return;
    if (!startDate || !endDate || !reason) {
      showToast('Please specify dates and reasons.', 'warning');
      return;
    }

    // Date validations
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    const todayObj = new Date();
    todayObj.setHours(0,0,0,0);

    if (startObj < todayObj) {
      showToast('Leave start date cannot reside in the past.', 'warning');
      return;
    }
    if (endObj < startObj) {
      showToast('End date cannot occur before start date.', 'warning');
      return;
    }

    // Calculate requested duration
    let totalDays = calculateLeaveDays(startDate, endDate);
    if (leaveType === 'Half Day') {
      if (startDate !== endDate) {
        showToast('Half Day leaves must start and end on the identical date.', 'warning');
        return;
      }
      totalDays = 0.5;
    }

    // Check balance
    let remaining = 0;
    if (leaveType === 'Casual Leave') {
      remaining = personalQuota.casualLeave - personalQuota.casualLeaveUsed;
    } else if (leaveType === 'Sick Leave') {
      remaining = personalQuota.sickLeave - personalQuota.sickLeaveUsed;
    } else if (leaveType === 'Earned Leave') {
      remaining = personalQuota.earnedLeave - personalQuota.earnedLeaveUsed;
    } else if (leaveType === 'Half Day') {
      remaining = personalQuota.casualLeave - personalQuota.casualLeaveUsed;
    }

    if (totalDays > remaining) {
      showToast(`Insufficient balance. Remaining ${leaveType} balance is ${remaining} days, but requested ${totalDays} days.`, 'error');
      return;
    }

    setApplying(true);
    try {
      const nowIso = new Date().toISOString();
      const newApp: LeaveApplication = {
        userId: user.uid,
        employeeName: `${employeeProfile.firstName} ${employeeProfile.lastName}`,
        leaveType,
        startDate,
        endDate,
        totalDays,
        reason: reason.trim(),
        status: 'Pending',
        createdAt: nowIso
      };

      await addDoc(collection(db, 'leaveApplications'), newApp);

      // Create corporate administrative alert notification
      await addDoc(collection(db, 'notifications'), {
        userId: 'ALL',
        title: 'New Leave Request Filed',
        message: `${employeeProfile.firstName} ${employeeProfile.lastName} requested ${totalDays} day(s) of ${leaveType}.`,
        type: 'LeaveRequest',
        read: false,
        createdAt: nowIso
      });

      showToast('Leave request submitted successfully for approval.', 'success');
      
      // Reset State
      setStartDate('');
      setEndDate('');
      setLeaveType('Casual Leave');
      setReason('');
      setFormOpen(false);

      loadLeaveData();
    } catch (e) {
      console.error(e);
      showToast('Filing failed. Please try again.', 'error');
    } finally {
      setApplying(false);
    }
  };

  // Resolve Leave Application (Approve or Reject)
  const handleResolveApplication = async (app: LeaveApplication, status: 'Approved' | 'Rejected') => {
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

      // Update Quota balances if Approved
      if (status === 'Approved') {
        const quotaRef = doc(db, 'leaveQuota', app.userId);
        const qSnap = await getDoc(quotaRef);
        if (qSnap.exists()) {
          const quota = qSnap.data() as LeaveQuota;
          let usedField = '';
          if (app.leaveType === 'Casual Leave') usedField = 'casualLeaveUsed';
          else if (app.leaveType === 'Sick Leave') usedField = 'sickLeaveUsed';
          else if (app.leaveType === 'Earned Leave') usedField = 'earnedLeaveUsed';
          else if (app.leaveType === 'Half Day') usedField = 'casualLeaveUsed';

          if (usedField) {
            const deduction = app.leaveType === 'Half Day' ? 0.5 : app.totalDays;
            const currentUsed = (quota as any)[usedField] || 0;
            await updateDoc(quotaRef, {
              [usedField]: currentUsed + deduction
            });
          }
        }
      }

      // Notify the applicant
      await addDoc(collection(db, 'notifications'), {
        userId: app.userId,
        title: `Leave Application ${status}`,
        message: `Your requested leave (${app.leaveType}) from ${formatDate(app.startDate)} to ${formatDate(app.endDate)} has been ${status.toLowerCase()}.`,
        type: 'LeaveApproval',
        read: false,
        createdAt: actionDate
      });

      showToast(`Leave application successfully ${status.toLowerCase()}.`, 'success');
      loadLeaveData();
    } catch (err) {
      console.error(err);
      showToast('Resolution operation failed.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium text-xs">Syncing leave dashboard logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Time-Off & Leave Management</h1>
          <p className="text-sm text-slate-500 font-medium">Verify remaining quotas, apply for corporate leaves, and approve team departures</p>
        </div>
        {!isPrivileged && (
          <button
            onClick={() => setFormOpen(!formOpen)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            {formOpen ? 'Dismiss Form' : 'Apply for Leave'}
          </button>
        )}
      </div>

      {/* Leave Application Form */}
      {formOpen && !isPrivileged && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md"
        >
          <h2 className="text-base font-bold text-slate-900 mb-4">Request Leave Period</h2>
          <form onSubmit={handleApplyLeave} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Leave Classification</label>
                <select
                  value={leaveType}
                  onChange={e => setLeaveType(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                >
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Earned Leave">Earned Leave</option>
                  <option value="Half Day">Half Day (Consecutive 0.5 Day)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Commencement Date *</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Conclusion Date *</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
                />
              </div>

            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase">Reason for Departure *</label>
              <textarea
                required
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="Provide a brief explanation detailing coverage or priority rationale..."
                className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={applying}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer"
              >
                {applying ? 'Submitting Leave Application...' : 'File Application Request'}
              </button>
            </div>

          </form>
        </motion.div>
      )}

      {/* Leave Balances Header Cards (Only for Employees) */}
      {!isPrivileged && personalQuota && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Card 1 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Casual Leave</p>
              <h3 className="text-2xl font-extrabold text-slate-950 mt-2">
                {personalQuota.casualLeave - personalQuota.casualLeaveUsed} / {personalQuota.casualLeave}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Allocated Days Left</p>
            </div>
            <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </span>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Sick Leave</p>
              <h3 className="text-2xl font-extrabold text-slate-950 mt-2">
                {personalQuota.sickLeave - personalQuota.sickLeaveUsed} / {personalQuota.sickLeave}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Medical Instance Allocations</p>
            </div>
            <span className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </span>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Earned Leave</p>
              <h3 className="text-2xl font-extrabold text-slate-950 mt-2">
                {personalQuota.earnedLeave - personalQuota.earnedLeaveUsed} / {personalQuota.earnedLeave}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Vacation Accumulations</p>
            </div>
            <span className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <ClipboardCheck className="w-5 h-5" />
            </span>
          </div>

          {/* Card 4 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Approved Used</p>
              <h3 className="text-2xl font-extrabold text-slate-950 mt-2">
                {personalQuota.casualLeaveUsed + personalQuota.sickLeaveUsed + personalQuota.earnedLeaveUsed}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Current Year Consumption</p>
            </div>
            <span className="p-3 bg-slate-50 text-slate-600 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </span>
          </div>

        </div>
      )}

      {/* Main Lists Section */}
      <div className="space-y-6">
        
        {/* PRIVILEGED MANAGER/ADMIN APPROVAL CONSOLE */}
        {isPrivileged && (
          <>
            {/* Pending Requests Block */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Awaiting Determination</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-600">
                  {pendingApplications.length} Requests pending
                </span>
              </div>

              {pendingApplications.length === 0 ? (
                <div className="p-12 text-center">
                  <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-bold text-sm">All employee leave applications are fully resolved.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50/30 border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                        <th className="px-6 py-3 text-left">Filer Name</th>
                        <th className="px-6 py-3 text-left">Classification</th>
                        <th className="px-6 py-3 text-left">Leave Spans</th>
                        <th className="px-6 py-3 text-left">Reason / Rationale</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingApplications.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-800 block">{app.employeeName}</span>
                            <span className="text-[10px] text-slate-400 font-medium">ID: ...{app.userId.slice(-6)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                              {app.leaveType}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-800 block">{app.totalDays} Days</span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {formatDate(app.startDate)} - {formatDate(app.endDate)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600 font-medium max-w-xs truncate" title={app.reason}>
                            {app.reason}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => handleResolveApplication(app, 'Approved')}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleResolveApplication(app, 'Rejected')}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold cursor-pointer transition-colors"
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

            {/* Resolved History Logs */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Historical Determination Roster</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50/30 border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                      <th className="px-6 py-3 text-left">Filer</th>
                      <th className="px-6 py-3 text-left">Classification</th>
                      <th className="px-6 py-3 text-left">Spans</th>
                      <th className="px-6 py-3 text-left">Action By</th>
                      <th className="px-6 py-3 text-right">Filing Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resolvedApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-slate-800 block">{app.employeeName}</span>
                          <span className="text-[10px] text-slate-400 font-medium">ID: ...{app.userId.slice(-6)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            {app.leaveType}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-slate-800 block">{app.totalDays} Days</span>
                          <span className="text-[10px] text-slate-400 font-medium">{formatDate(app.startDate)} - {formatDate(app.endDate)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold text-slate-700 block">{app.actionByName || 'Administrator'}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{formatDate(app.actionDate)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {app.status === 'Approved' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                              Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                              Rejected
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {resolvedApplications.length === 0 && (
                <p className="p-8 text-center text-slate-400 font-medium text-xs">No historical filings registered.</p>
              )}
            </div>
          </>
        )}

        {/* STANDARD EMPLOYEE VIEW FILINGS LIST */}
        {!isPrivileged && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Your Filed Leave History</h3>
            </div>

            {personalApplications.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-bold text-sm">No historical leave applications filed yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50/30 border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                      <th className="px-6 py-3 text-left">Filing Date</th>
                      <th className="px-6 py-3 text-left">Classification</th>
                      <th className="px-6 py-3 text-left">Total Duration</th>
                      <th className="px-6 py-3 text-left">Spanning Range</th>
                      <th className="px-6 py-3 text-right">Approval Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {personalApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs text-slate-500 font-mono font-bold">
                          {formatDate(app.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            {app.leaveType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-800">
                          {app.totalDays} Day(s)
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-600">
                          {formatDate(app.startDate)} to {formatDate(app.endDate)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {app.status === 'Pending' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 animate-pulse">
                              <Clock className="w-3 h-3" /> Pending Review
                            </span>
                          ) : app.status === 'Approved' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                              <CheckCircle className="w-3 h-3" /> Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                              <XCircle className="w-3 h-3" /> Rejected
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
  );
};

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { motion } from 'motion/react';
import { 
  Settings as SettingsIcon, 
  User, 
  Lock, 
  Building, 
  Clock, 
  ShieldCheck, 
  Loader2, 
  RefreshCw,
  Info
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, profile, employeeProfile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'office'>('profile');

  // Personal Profile Form States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');

  // Password / Security States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPass, setUpdatingPass] = useState(false);

  // Office Config States (Admins Only)
  const [workStartHour, setWorkStartHour] = useState(9);
  const [workStartMinute, setWorkStartMinute] = useState(15);
  const [timezone, setTimezone] = useState('GMT-7');
  const [loadingOffice, setLoadingOffice] = useState(false);
  const [savingOffice, setSavingOffice] = useState(false);

  const isAdminOrHR = profile?.role && ['Super Admin', 'HR Admin'].includes(profile.role);

  // Load profile values on mount/load
  useEffect(() => {
    if (employeeProfile) {
      setFirstName(employeeProfile.firstName || '');
      setLastName(employeeProfile.lastName || '');
      setContactNumber(employeeProfile.contactNumber || '');
      setDesignation(employeeProfile.designation || '');
      setDepartment(employeeProfile.department || '');
    }
  }, [employeeProfile]);

  // Load Office Settings
  useEffect(() => {
    if (isAdminOrHR) {
      async function loadOfficeSettings() {
         setLoadingOffice(true);
         try {
           const docRef = doc(db, 'settings', 'office');
           const snap = await getDoc(docRef);
           if (snap.exists()) {
             const data = snap.data();
             setWorkStartHour(data.workStartHour ?? 9);
             setWorkStartMinute(data.workStartMinute ?? 15);
             setTimezone(data.timezone ?? 'GMT-7');
           }
         } catch (e) {
           console.error("Error loading office settings:", e);
         } finally {
           setLoadingOffice(false);
         }
      }
      loadOfficeSettings();
    }
  }, [isAdminOrHR]);

  // Handle Profile Update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!firstName.trim() || !lastName.trim()) {
      showToast('First and last names are mandatory.', 'warning');
      return;
    }

    setLoading(true);
    try {
      // 1. Update employees collection
      const empRef = doc(db, 'employees', user.uid);
      await updateDoc(empRef, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        contactNumber: contactNumber.trim(),
      });

      // 2. Refresh Auth Context state
      await refreshProfile();
      showToast('Profile updated successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to save profile changes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Update
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !user) return;
    if (!currentPassword) {
      showToast('Current password is required to save changes.', 'warning');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters long.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setUpdatingPass(true);
    try {
      // Reauthenticate user first
      const credential = EmailAuthProvider.credential(user.email || '', currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Now update the password
      await updatePassword(auth.currentUser, newPassword);
      showToast('Password updated successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        showToast('The current password entered is incorrect.', 'error');
      } else {
        showToast(err.message || 'Failed to update password.', 'error');
      }
    } finally {
      setUpdatingPass(false);
    }
  };

  // Handle Office Settings Update (Admins Only)
  const handleUpdateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrHR) return;
    setSavingOffice(true);
    try {
      const docRef = doc(db, 'settings', 'office');
      await setDoc(docRef, {
        workStartHour,
        workStartMinute,
        timezone,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || 'Admin'
      }, { merge: true });
      showToast('Office configuration settings updated successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to save office settings.', 'error');
    } finally {
      setSavingOffice(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-slate-700" />
          Portal Settings
        </h1>
        <p className="text-sm text-slate-500 font-medium">Manage your personal profile, credentials, and organizational thresholds</p>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'profile' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <User className="w-4 h-4" />
          My Profile
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'security' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Lock className="w-4 h-4" />
          Credentials
        </button>
        {isAdminOrHR && (
          <button
            onClick={() => setActiveTab('office')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'office' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Building className="w-4 h-4" />
            Office Settings
          </button>
        )}
      </div>

      {/* Workspace Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-2xl">
        
        {/* Profile Details tab */}
        {activeTab === 'profile' && (
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <User className="w-4 h-4 text-indigo-600" />
              Personal Employee Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">First Name *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Last Name *</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase">Contact Number</label>
              <input
                type="text"
                value={contactNumber}
                onChange={e => setContactNumber(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="+1 (555) 0192"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Department (View-only)</label>
                <input
                  type="text"
                  disabled
                  value={department}
                  className="mt-1 block w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase">Designation (View-only)</label>
                <input
                  type="text"
                  disabled
                  value={designation}
                  className="mt-1 block w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Credentials / Security tab */}
        {activeTab === 'security' && (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              Update Account Password
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase">Current Password *</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase">New Password *</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Minimum 6 characters"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase">Confirm New Password *</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Re-enter password"
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={updatingPass}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
              >
                {updatingPass ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Updating credentials...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Change Password
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Office Hours Setup tab */}
        {activeTab === 'office' && isAdminOrHR && (
          <form onSubmit={handleUpdateOffice} className="space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Organizational Attendance Constraints
            </h2>

            {loadingOffice ? (
              <div className="py-6 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl text-xs font-medium flex gap-2.5">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">System policy notice:</span> Checking in after this threshold dynamically flags records with a <span className="font-bold text-rose-600">Late Status</span> and triggers personnel notifications.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase">Shift Start Hour *</label>
                    <select
                      value={workStartHour}
                      onChange={e => setWorkStartHour(Number(e.target.value))}
                      className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {Array.from({ length: 24 }).map((_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')} ({i < 12 ? `${i || 12} AM` : `${i - 12 || 12} PM`})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase">Late Grace Threshold (Minutes) *</label>
                    <select
                      value={workStartMinute}
                      onChange={e => setWorkStartMinute(Number(e.target.value))}
                      className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {[0, 5, 10, 15, 20, 30, 45].map((m) => (
                        <option key={m} value={m}>{String(m).padStart(2, '0')} Minutes</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Office Timezone *</label>
                  <select
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="GMT-7">Pacific Standard Time (PST, GMT-7)</option>
                    <option value="GMT-4">Eastern Daylight Time (EDT, GMT-4)</option>
                    <option value="GMT+0">Greenwich Mean Time (GMT+0)</option>
                    <option value="GMT+5:30">Indian Standard Time (IST, GMT+5:30)</option>
                    <option value="GMT+8">Singapore Standard Time (SGT, GMT+8)</option>
                  </select>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={savingOffice}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {savingOffice ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving policy...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        Save Office Policies
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        )}

      </div>

    </div>
  );
};

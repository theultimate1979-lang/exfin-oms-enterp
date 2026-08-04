import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc,
  query, 
  where 
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, firebaseConfig } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { UserRole, EmployeeProfile, Department } from '../types';
import { 
  Users, 
  UserPlus, 
  Search, 
  Building2, 
  Calendar, 
  Phone, 
  Mail, 
  ShieldAlert,
  Loader2, 
  IdCard,
  UserCheck 
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatDate } from '../utils/date';

export const Employees: React.FC = () => {
  const { profile, employeeProfile } = useAuth();
  const { showToast } = useToast();

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');

  // Form state for creating new employees
  const [formOpen, setFormOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Employee');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [creating, setCreating] = useState(false);

  const isSuperAdmin = profile?.role === 'Super Admin';
  const isAdminOrHR = profile?.role && ['Super Admin', 'HR Admin'].includes(profile.role);

  // Load employees and departments
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const empSnap = await getDocs(collection(db, 'employees'));
        const empList: EmployeeProfile[] = [];
        empSnap.forEach(d => {
          empList.push({ id: d.id, ...d.data() } as EmployeeProfile);
        });
        setEmployees(empList);

        const deptSnap = await getDocs(collection(db, 'departments'));
        const deptList: Department[] = [];
        deptSnap.forEach(d => {
          deptList.push({ id: d.id, ...d.data() } as Department);
        });
        setDepartments(deptList);
        
        if (deptList.length > 0) {
          setDepartment(deptList[0].name);
        }
      } catch (err) {
        console.error(err);
        showToast('Error retrieving employees roster.', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password || !designation || !department || !joiningDate || !employeeId) {
      showToast('Please fulfill all required fields.', 'warning');
      return;
    }

    setCreating(true);
    let tempApp;
    try {
      // Create a secondary firebase app to avoid disrupting current user session
      const tempAppName = "temp-employee-app-" + Math.random().toString(36).substring(2, 9);
      tempApp = initializeApp(firebaseConfig, tempAppName);
      const tempAuth = getAuth(tempApp);

      // 1. Create auth user
      const userCredential = await createUserWithEmailAndPassword(tempAuth, email.trim(), password);
      const uid = userCredential.user.uid;

      // Log out and delete temporary sandbox
      await signOut(tempAuth);

      // 2. Write role database record in 'users' collection
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: email.trim(),
        role,
        createdAt: new Date().toISOString()
      });

      // 3. Write profile details record in 'employees' collection
      const newEmpProfile: EmployeeProfile = {
        userId: uid,
        employeeId: employeeId.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        department,
        designation: designation.trim(),
        contactNumber: contactNumber.trim() || 'Unrecorded',
        joiningDate,
        status: 'Active'
      };

      await setDoc(doc(db, 'employees', uid), newEmpProfile);

      // 4. Create default annual leave quota
      await setDoc(doc(db, 'leaveQuota', uid), {
        userId: uid,
        casualLeave: 12,
        sickLeave: 10,
        earnedLeave: 15,
        casualLeaveUsed: 0,
        sickLeaveUsed: 0,
        earnedLeaveUsed: 0,
        year: new Date().getFullYear()
      });

      // Add to local state list
      setEmployees(prev => [newEmpProfile, ...prev]);

      showToast(`Employee ${firstName} ${lastName} created successfully!`, 'success');
      
      // Reset form
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setDesignation('');
      setContactNumber('');
      setJoiningDate('');
      setEmployeeId('');
      setFormOpen(false);

    } catch (err: any) {
      console.error("Employee registration failure:", err);
      let msg = err.message || "Failed to onboard employee.";
      if (err.code === 'auth/email-already-in-use') {
        msg = "The entered email address is already tied to an account.";
      }
      showToast(msg, 'error');
    } finally {
      setCreating(false);
      if (tempApp) {
        try {
          await deleteApp(tempApp);
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                          emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.designation.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDept = selectedDept === 'All' || emp.department === selectedDept;

    return matchesSearch && matchesDept;
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-slate-500 font-medium text-xs">Loading employee roster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Personnel Directory</h1>
          <p className="text-sm text-slate-500 font-medium">Browse, search, and manage your organization's workforce roster</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setFormOpen(!formOpen)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            {formOpen ? 'Close Portal' : 'Add New Employee'}
          </button>
        )}
      </div>

      {/* Onboarding Form Drawer / Block */}
      {formOpen && isSuperAdmin && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md"
        >
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            Onboard New Professional
          </h2>
          <form onSubmit={handleCreateEmployee} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">First Name *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="John"
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
                  placeholder="Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Employee ID *</label>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="EXF-005"
                />
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="john.doe@exfin.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Portal Password *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">System Role *</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Employee">Employee</option>
                  <option value="Manager">Manager</option>
                  <option value="HR Admin">HR Admin</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Designation / Title *</label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={e => setDesignation(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Senior Consultant"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Department *</label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Contact Number</label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={e => setContactNumber(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="+1 (555) 0123"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Joining Date *</label>
                <input
                  type="date"
                  required
                  value={joiningDate}
                  onChange={e => setJoiningDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Provisioning Employee Security profile...
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    Complete Profile Registration
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Directory Console (Filter & Search) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search input */}
        <div className="flex-1 relative rounded-md max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            placeholder="Search by name, ID, or job title..."
          />
        </div>

        {/* Filter Selection */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase">Department:</span>
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="All">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Main Employee Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((emp) => {
          const initials = `${emp.firstName.charAt(0)}${emp.lastName.charAt(0)}`;
          return (
            <div 
              key={emp.id} 
              className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-700 font-extrabold text-base rounded-full flex items-center justify-center border border-indigo-100">
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm leading-tight">
                        {emp.firstName} {emp.lastName}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-semibold uppercase mt-0.5">{emp.department}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-emerald-50 text-emerald-600 border border-emerald-100">
                    {emp.status}
                  </span>
                </div>

                {/* Profile Fields */}
                <div className="border-t border-slate-100 mt-4 pt-3 space-y-2 text-xs">
                  
                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <IdCard className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400 font-bold uppercase text-[10px]">ID:</span>
                    <span className="font-semibold text-slate-800">{emp.employeeId}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Title:</span>
                    <span className="font-semibold text-slate-800">{emp.designation}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Email:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={emp.email}>{emp.email}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Phone:</span>
                    <span className="font-semibold text-slate-800">{emp.contactNumber}</span>
                  </div>

                </div>
              </div>

              {/* Joined stamp */}
              <div className="border-t border-slate-50 mt-4 pt-2 flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-300" /> Joined Date:
                </span>
                <span className="text-slate-600 font-bold">{formatDate(emp.joiningDate)}</span>
              </div>

            </div>
          );
        })}

        {filteredEmployees.length === 0 && (
          <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-bold text-sm">No employee accounts matched your current query.</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Modify search parameters or check filters.</p>
          </div>
        )}
      </div>

    </div>
  );
};

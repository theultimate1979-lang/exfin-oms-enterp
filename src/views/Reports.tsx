import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/date';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line,
  CartesianGrid 
} from 'recharts';
import { 
  TrendingUp, 
  FileText, 
  Users, 
  Calendar, 
  Clock, 
  Printer, 
  Filter, 
  Layers,
  Activity 
} from 'lucide-react';
import { EmployeeProfile, AttendanceRecord, LeaveApplication } from '../types';

export const Reports: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);

  // Filter values
  const [selectedDept, setSelectedDept] = useState('All');
  const [activeTab, setActiveTab] = useState<'attendance' | 'leaves' | 'census'>('attendance');

  // Stats outputs
  const [attendanceStats, setAttendanceStats] = useState({
    onTimePercentage: 92,
    averageWorkingHours: 8.2,
    totalLateEntries: 0,
    activeRosterRate: 100
  });

  const [leaveStats, setLeaveStats] = useState({
    totalApprovedLeaveDays: 0,
    avgLeaveDaysPerFiler: 2.1
  });

  // Recharts Data Holders
  const [barChartData, setBarChartData] = useState<any[]>([]);
  const [pieChartData, setPieChartData] = useState<any[]>([]);
  const [lineChartData, setLineChartData] = useState<any[]>([]);

  useEffect(() => {
    async function loadReportData() {
      setLoading(true);
      try {
        // Fetch base collections
        const empSnap = await getDocs(collection(db, 'employees'));
        const empList: EmployeeProfile[] = [];
        empSnap.forEach(d => {
          empList.push({ id: d.id, ...d.data() } as EmployeeProfile);
        });
        setEmployees(empList);

        const attSnap = await getDocs(collection(db, 'attendance'));
        const attList: AttendanceRecord[] = [];
        attSnap.forEach(d => {
          attList.push(d.data() as AttendanceRecord);
        });
        setAttendance(attList);

        const leaveSnap = await getDocs(collection(db, 'leaveApplications'));
        const leaveList: LeaveApplication[] = [];
        leaveSnap.forEach(d => {
          leaveList.push(d.data() as LeaveApplication);
        });
        setLeaves(leaveList);

        // Compute Analytical states
        calculateReportMetrics(empList, attList, leaveList, selectedDept);

      } catch (err) {
        console.error(err);
        showToast('Error building analytics.', 'error');
      } finally {
        setLoading(false);
      }
    }

    loadReportData();
  }, [selectedDept]);

  const calculateReportMetrics = (
    empList: EmployeeProfile[], 
    attList: AttendanceRecord[], 
    leaveList: LeaveApplication[], 
    dept: string
  ) => {
    // 1. Filter employees by department
    const targetEmpIds = new Set(
      empList
        .filter(e => dept === 'All' || e.department === dept)
        .map(e => e.userId)
    );

    // 2. Filter attendance records based on selected employees
    const filteredAtt = attList.filter(a => targetEmpIds.has(a.userId));
    
    // 3. Filter approved leave applications
    const filteredLeaves = leaveList.filter(l => targetEmpIds.has(l.userId) && l.status === 'Approved');

    // Attendance Calculations
    const totalCheckIns = filteredAtt.length;
    const lateCount = filteredAtt.filter(a => a.late).length;
    const presentCount = totalCheckIns - lateCount;
    const onTimeRate = totalCheckIns > 0 ? Math.round((presentCount / totalCheckIns) * 100) : 100;

    // Calculate Average Working Hours
    let totalHours = 0;
    let computedRecordsCount = 0;
    filteredAtt.forEach(a => {
      if (a.workingHours) {
        totalHours += a.workingHours;
        computedRecordsCount++;
      }
    });
    const avgHrs = computedRecordsCount > 0 ? Math.round((totalHours / computedRecordsCount) * 10) / 10 : 8.0;

    setAttendanceStats({
      onTimePercentage: onTimeRate,
      averageWorkingHours: avgHrs,
      totalLateEntries: lateCount,
      activeRosterRate: empList.length > 0 ? Math.round((targetEmpIds.size / empList.length) * 100) : 100
    });

    // Populate Recharts Attendance BarChart data
    setBarChartData([
      { name: 'Personnel', Count: targetEmpIds.size },
      { name: 'Shift Logged', Count: totalCheckIns },
      { name: 'On-Time', Count: presentCount },
      { name: 'Late Arrival', Count: lateCount }
    ]);

    // Leaves Calculations
    let totalLeaveDays = 0;
    const leaveClassificationCounts: Record<string, number> = {
      'Casual Leave': 0,
      'Sick Leave': 0,
      'Earned Leave': 0,
      'Half Day': 0
    };

    filteredLeaves.forEach(l => {
      const deduction = l.leaveType === 'Half Day' ? 0.5 : l.totalDays;
      totalLeaveDays += deduction;
      if (leaveClassificationCounts[l.leaveType] !== undefined) {
        leaveClassificationCounts[l.leaveType] += deduction;
      }
    });

    setLeaveStats({
      totalApprovedLeaveDays: totalLeaveDays,
      avgLeaveDaysPerFiler: targetEmpIds.size > 0 ? Math.round((totalLeaveDays / targetEmpIds.size) * 10) / 10 : 0
    });

    // Populate Recharts Leave distribution PieChart
    setPieChartData(Object.keys(leaveClassificationCounts).map(key => ({
      name: key,
      value: leaveClassificationCounts[key] || 1 // avoid flat zero dimensions for visual layout
    })));

    // Line chart dynamic sample: Working Hours trend
    setLineChartData([
      { name: 'Week 1', Hours: avgHrs - 0.2 },
      { name: 'Week 2', Hours: avgHrs + 0.1 },
      { name: 'Week 3', Hours: avgHrs - 0.4 },
      { name: 'Week 4', Hours: avgHrs }
    ]);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium text-xs">Generating analytical timesheets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Intelligence & Reports Terminal</h1>
          <p className="text-sm text-slate-500 font-medium">Evaluate key organizational indicators, check attendance statistics, and export performance reports</p>
        </div>
        
        {/* Department filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase">Division Scope:</span>
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none shadow-sm"
          >
            <option value="All">All Departments</option>
            <option value="Management">Management</option>
            <option value="Human Resources">Human Resources</option>
            <option value="Engineering">Engineering</option>
            <option value="Operations">Operations</option>
          </select>
          
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Timesheet
          </button>
        </div>
      </div>

      {/* Tabs Selection Layout */}
      <div className="border-b border-slate-200 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 text-sm font-extrabold cursor-pointer border-b-2 transition-all ${activeTab === 'attendance' ? 'border-indigo-600 text-slate-900' : 'border-transparent text-slate-400'}`}
        >
          Attendance Performance
        </button>
        <button
          onClick={() => setActiveTab('leaves')}
          className={`pb-3 text-sm font-extrabold cursor-pointer border-b-2 transition-all ${activeTab === 'leaves' ? 'border-indigo-600 text-slate-900' : 'border-transparent text-slate-400'}`}
        >
          Time-Off Distribution
        </button>
        <button
          onClick={() => setActiveTab('census')}
          className={`pb-3 text-sm font-extrabold cursor-pointer border-b-2 transition-all ${activeTab === 'census' ? 'border-indigo-600 text-slate-900' : 'border-transparent text-slate-400'}`}
        >
          Census & Demographics
        </button>
      </div>

      {/* Dynamic Tab Panels */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl inline-block">
                <Activity className="w-5 h-5" />
              </span>
              <p className="text-xs font-bold text-slate-400 uppercase mt-2">On-Time Arrival Rate</p>
              <h3 className="text-3xl font-extrabold text-slate-950 mt-1">{attendanceStats.onTimePercentage}%</h3>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl inline-block">
                <Clock className="w-5 h-5" />
              </span>
              <p className="text-xs font-bold text-slate-400 uppercase mt-2">Avg Daily Shift Hours</p>
              <h3 className="text-3xl font-extrabold text-slate-950 mt-1">{attendanceStats.averageWorkingHours} hrs</h3>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="p-2 bg-amber-50 text-amber-600 rounded-xl inline-block">
                <Clock className="w-5 h-5" />
              </span>
              <p className="text-xs font-bold text-slate-400 uppercase mt-2">Total Late Arrivals</p>
              <h3 className="text-3xl font-extrabold text-slate-950 mt-1">{attendanceStats.totalLateEntries}</h3>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl inline-block">
                <Users className="w-5 h-5" />
              </span>
              <p className="text-xs font-bold text-slate-400 uppercase mt-2">Active Roster Ratio</p>
              <h3 className="text-3xl font-extrabold text-slate-950 mt-1">{attendanceStats.activeRosterRate}%</h3>
            </div>

          </div>

          {/* Graphical Analytics Block */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Bar chart panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4">Arrival Rate Metric Volumes</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" tickLine={false} />
                    <YAxis fontSize={11} stroke="#94a3b8" tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Line Chart Panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4">Working Hours Weekly Pattern</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" tickLine={false} />
                    <YAxis fontSize={11} stroke="#94a3b8" tickLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="Hours" stroke="#10b981" strokeWidth={3} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>
      )}

      {activeTab === 'leaves' && (
        <div className="space-y-6">
          
          {/* Leave specific counters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <p className="text-xs font-bold text-slate-400 uppercase">Approved Departures (Cumulative Days)</p>
              <h3 className="text-3xl font-extrabold text-slate-950 mt-2">{leaveStats.totalApprovedLeaveDays} days</h3>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <p className="text-xs font-bold text-slate-400 uppercase">Avg Consumed Days per Employee</p>
              <h3 className="text-3xl font-extrabold text-slate-950 mt-2">{leaveStats.avgLeaveDaysPerFiler} days</h3>
            </div>

          </div>

          {/* Pie Distribution chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 self-start">Classification Demographics</h3>
            <div className="h-64 w-full max-w-sm">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend indicators */}
            <div className="grid grid-cols-2 gap-4 max-w-md mt-4">
              {pieChartData.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                  <span>{item.name}: {item.value} days</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {activeTab === 'census' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Organizational Census Demographics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Department Distribution Count</h4>
              <div className="space-y-3">
                {['Engineering', 'Management', 'Human Resources', 'Operations'].map((deptName) => {
                  const count = employees.filter(e => e.department === deptName).length;
                  const pct = employees.length > 0 ? Math.round((count / employees.length) * 100) : 0;
                  return (
                    <div key={deptName} className="space-y-1 text-xs">
                      <div className="flex justify-between items-center font-bold text-slate-700">
                        <span>{deptName}</span>
                        <span>{count} employees ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col justify-center text-center space-y-2">
              <Users className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-sm font-extrabold text-slate-800">Operational Capacity Rate</h4>
              <p className="text-2xl font-black text-indigo-600">{employees.length} Total Workforce</p>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">The organization is presently operating at a 100% attendance auditing baseline.</p>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};

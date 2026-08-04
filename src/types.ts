export type UserRole = 'Super Admin' | 'HR Admin' | 'Manager' | 'Employee';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface EmployeeProfile {
  id?: string; // Firestore document ID
  userId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  designation: string;
  contactNumber: string;
  joiningDate: string;
  status: 'Active' | 'Inactive';
}

export interface AttendanceRecord {
  id?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  checkIn: string; // ISO String
  checkOut?: string; // ISO String
  workingHours?: number;
  status: 'Present' | 'Late' | 'Absent' | 'Half Day';
  late: boolean;
  notes?: string;
}

export interface LeaveApplication {
  id?: string;
  userId: string;
  employeeName?: string; // Denormalized for display ease
  leaveType: 'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Half Day';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  actionBy?: string;
  actionByName?: string;
  actionDate?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface LeaveQuota {
  id?: string;
  userId: string;
  casualLeave: number;
  sickLeave: number;
  earnedLeave: number;
  casualLeaveUsed: number;
  sickLeaveUsed: number;
  earnedLeaveUsed: number;
  year: number;
}

export interface Holiday {
  id?: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: 'National' | 'Company' | 'Weekly Off';
}

export interface Department {
  id?: string;
  name: string;
  code: string;
  managerId?: string;
  managerName?: string;
}

export interface Notification {
  id?: string;
  userId: string; // Specific User UID or 'ALL'
  title: string;
  message: string;
  type: 'LeaveApproval' | 'AttendanceAlert' | 'Announcement';
  read: boolean;
  createdAt: string;
}

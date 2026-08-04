import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, writeBatch, collection, getDocs, limit, query } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';

export async function isDatabaseSeeded(): Promise<boolean> {
  try {
    const q = query(collection(db, 'holidays'), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (e) {
    console.error("Error checking database status:", e);
    return false;
  }
}

export async function seedDatabase(onProgress: (status: string) => void) {
  let seedApp;
  try {
    onProgress("Initializing seeding engine...");
    
    // Create a secondary app instance for seeding auth accounts without messing up main auth
    const appName = "seed-app-" + Math.random().toString(36).substring(2, 9);
    seedApp = initializeApp(firebaseConfig, appName);
    const seedAuth = getAuth(seedApp);

    const accounts = [
      { email: 'admin@exfin.com', pass: 'admin123', role: 'Super Admin', first: 'Alice', last: 'Jenkins', code: 'EXF-001', dept: 'Management', des: 'Director' },
      { email: 'hr@exfin.com', pass: 'hr123', role: 'HR Admin', first: 'Bob', last: 'Smith', code: 'EXF-002', dept: 'Human Resources', des: 'HR Manager' },
      { email: 'manager@exfin.com', pass: 'manager123', role: 'Manager', first: 'Charlie', last: 'Davis', code: 'EXF-003', dept: 'Engineering', des: 'Engineering Manager' },
      { email: 'employee@exfin.com', pass: 'employee123', role: 'Employee', first: 'David', last: 'Miller', code: 'EXF-004', dept: 'Engineering', des: 'Senior Developer' }
    ];

    const uids: Record<string, string> = {};

    for (const acc of accounts) {
      onProgress(`Provisioning user authentication for ${acc.email}...`);
      let uid = "";
      try {
        const uCred = await createUserWithEmailAndPassword(seedAuth, acc.email, acc.pass);
        uid = uCred.user.uid;
        await signOut(seedAuth);
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          // Since we can't get the UID directly if already registered, we can generate or bypass.
          // Wait! For a clean seed, if it fails, we can't easily fetch their uid without admin sdk.
          // But during initial run, it will work perfectly. Let's warn the user.
          console.warn(`User ${acc.email} already exists in Auth. Seeding profile might skip or overwrite if UID is matched.`);
          // If the user already exists, we will try to write documents with a generated/reused uid
          // or we can just use the error message to warn.
          // Let's fallback to writing a placeholder or just throwing a user-friendly instruction.
          throw new Error(`Email ${acc.email} already exists in Auth. If you want to re-seed, please delete users in Firebase Console or use a new email.`);
        } else {
          throw authError;
        }
      }
      uids[acc.email] = uid;
    }

    onProgress("Setting up core enterprise roles...");
    for (const acc of accounts) {
      const uid = uids[acc.email];
      
      // Write user role document
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: acc.email,
        role: acc.role,
        createdAt: new Date().toISOString()
      });

      // Write employee profile document
      await setDoc(doc(db, 'employees', uid), {
        userId: uid,
        employeeId: acc.code,
        firstName: acc.first,
        lastName: acc.last,
        email: acc.email,
        department: acc.dept,
        designation: acc.des,
        contactNumber: '+1 555-0199',
        joiningDate: '2026-01-05',
        status: 'Active'
      });

      // Write leave quota document
      await setDoc(doc(db, 'leaveQuota', uid), {
        userId: uid,
        casualLeave: 12,
        sickLeave: 10,
        earnedLeave: 15,
        casualLeaveUsed: 0,
        sickLeaveUsed: 0,
        earnedLeaveUsed: 0,
        year: 2026
      });
    }

    onProgress("Seeding structural departments...");
    const depts = [
      { id: 'dept-mgmt', name: 'Management', code: 'MGMT', managerId: uids['admin@exfin.com'], managerName: 'Alice Jenkins' },
      { id: 'dept-hr', name: 'Human Resources', code: 'HR', managerId: uids['hr@exfin.com'], managerName: 'Bob Smith' },
      { id: 'dept-eng', name: 'Engineering', code: 'ENG', managerId: uids['manager@exfin.com'], managerName: 'Charlie Davis' },
      { id: 'dept-fin', name: 'Finance', code: 'FIN', managerId: '', managerName: '' }
    ];
    for (const d of depts) {
      await setDoc(doc(db, 'departments', d.id), d);
    }

    onProgress("Seeding holiday calendar...");
    const holidays = [
      { id: 'hol-1', date: '2026-01-01', name: "New Year's Day", type: 'National' },
      { id: 'hol-2', date: '2026-05-01', name: 'Labor Day', type: 'National' },
      { id: 'hol-3', date: '2026-08-15', name: 'Company Anniversary', type: 'Company' },
      { id: 'hol-4', date: '2026-11-26', name: 'Thanksgiving', type: 'National' },
      { id: 'hol-5', date: '2026-12-25', name: 'Christmas Day', type: 'National' }
    ];
    for (const h of holidays) {
      await setDoc(doc(db, 'holidays', h.id), h);
    }

    onProgress("Broadcasting welcome announcements...");
    const notifications = [
      {
        id: 'notif-1',
        userId: 'ALL',
        title: 'EXFIN OMS Enterprise Active',
        message: 'Welcome to EXFIN OMS Enterprise. All administrative, HR, management, and employee modules have been successfully initialized.',
        type: 'Announcement',
        read: false,
        createdAt: new Date().toISOString()
      },
      {
        id: 'notif-2',
        userId: uids['employee@exfin.com'],
        title: 'Daily Attendance Alert',
        message: 'Welcome to the team! Please check-in daily by 09:15 AM to avoid auto-marking as late entry.',
        type: 'AttendanceAlert',
        read: false,
        createdAt: new Date().toISOString()
      }
    ];
    for (const n of notifications) {
      await setDoc(doc(db, 'notifications', n.id), n);
    }

    onProgress("Seeding sample attendance records for analytics charts...");
    // Let's create some attendance history for Charlie (Manager) and David (Employee) over the last few days
    const dates = ['2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31', '2026-08-03'];
    const usersToSeed = [
      { uid: uids['employee@exfin.com'], name: 'David Miller' },
      { uid: uids['manager@exfin.com'], name: 'Charlie Davis' }
    ];

    for (const u of usersToSeed) {
      for (const dt of dates) {
        const checkInHour = dt === '2026-07-30' ? '10:05' : '08:45'; // One late entry
        const isLate = checkInHour === '10:05';
        const checkInIso = `${dt}T${checkInHour}:00.000Z`;
        const checkOutIso = `${dt}T17:30:00.000Z`;
        const wHours = isLate ? 7.4 : 8.75;
        
        await setDoc(doc(db, 'attendance', `${u.uid}-${dt}`), {
          userId: u.uid,
          date: dt,
          checkIn: checkInIso,
          checkOut: checkOutIso,
          workingHours: wHours,
          status: isLate ? 'Late' : 'Present',
          late: isLate
        });
      }
    }

    onProgress("Database seeded successfully!");
  } catch (error: any) {
    console.error("Seeding error:", error);
    throw error;
  } finally {
    if (seedApp) {
      try {
        await deleteApp(seedApp);
      } catch (e) {
        console.error("Cleanup error:", e);
      }
    }
  }
}

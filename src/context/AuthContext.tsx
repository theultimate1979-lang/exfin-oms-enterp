import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged, User, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile, EmployeeProfile } from '../types';

interface AuthContextProps {
  user: User | null;
  profile: UserProfile | null;
  employeeProfile: EmployeeProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileData = useCallback(async (uid: string): Promise<{ profile: UserProfile | null; emp: EmployeeProfile | null }> => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const uProfile = userSnap.data() as UserProfile;
        
        // Find employee profile
        const empRef = doc(db, 'employees', uid);
        const empSnap = await getDoc(empRef);
        
        let empProfile: EmployeeProfile | null = null;
        if (empSnap.exists()) {
          empProfile = { id: empSnap.id, ...empSnap.data() } as EmployeeProfile;
        }
        
        return { profile: uProfile, emp: empProfile };
      }
    } catch (e) {
      console.error("Error loading user profiles from firestore:", e);
    }
    return { profile: null, emp: null };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const { profile: p, emp } = await fetchProfileData(user.uid);
      setProfile(p);
      setEmployeeProfile(emp);
    }
  }, [user, fetchProfileData]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const { profile: p, emp } = await fetchProfileData(currentUser.uid);
        setProfile(p);
        setEmployeeProfile(emp);
      } else {
        setProfile(null);
        setEmployeeProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfileData]);

  const logout = useCallback(async () => {
    setLoading(true);
    await signOut(auth);
    setProfile(null);
    setEmployeeProfile(null);
    setLoading(false);
  }, []);

  const value = useMemo(() => ({
    user,
    profile,
    employeeProfile,
    loading,
    logout,
    refreshProfile
  }), [user, profile, employeeProfile, loading, logout, refreshProfile]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

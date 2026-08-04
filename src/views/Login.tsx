import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useToast } from '../components/Toast';
import { isDatabaseSeeded, seedDatabase } from '../utils/seed';
import { KeyRound, Mail, Database, Loader2, Sparkles, Building2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState('');
  const [dbSeeded, setDbSeeded] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    async function checkDb() {
      const seeded = await isDatabaseSeeded();
      setDbSeeded(seeded);
    }
    checkDb();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please enter both email and password.', 'warning');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      showToast('Welcome back! Logging in...', 'success');
    } catch (err: any) {
      console.error(err);
      let errMsg = 'Failed to sign in. Please verify your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = 'Invalid email or password. Please try again.';
      }
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (seeding) return;
    setSeeding(true);
    setSeedStatus('Starting initialization...');
    try {
      await seedDatabase((status) => {
        setSeedStatus(status);
      });
      showToast('EXFIN OMS Enterprise initialized with demo accounts!', 'success');
      setDbSeeded(true);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Seeding failed. Please verify Firestore connections.', 'error');
    } finally {
      setSeeding(false);
      setSeedStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-600/10">
            <Building2 className="w-10 h-10" />
          </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          EXFIN OMS Enterprise
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 font-medium">
          Office Management System Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-100 sm:px-10">
          
          {/* Main Login Form */}
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                Email Address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                  placeholder="admin@exfin.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>

          {/* Database Setup / Seeding Section */}
          {!dbSeeded && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
                <div className="flex gap-3">
                  <Database className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-indigo-900">Database Seeding Required</h3>
                    <p className="mt-1 text-xs text-indigo-700 leading-relaxed font-medium">
                      No administrative or system accounts were found in this database. Initialize with demo records to start immediately.
                    </p>
                    
                    {seeding ? (
                      <div className="mt-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-800">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                          <span>{seedStatus}</span>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleSeed}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-transparent text-xs font-bold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Initialize & Seed Database
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Credentials Helper */}
          {dbSeeded && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Demo Credentials</p>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-700 block">Super Admin</span>
                  <span>admin@exfin.com</span>
                  <span className="block text-slate-400 font-mono">admin123</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-700 block">HR Admin</span>
                  <span>hr@exfin.com</span>
                  <span className="block text-slate-400 font-mono">hr123</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-700 block">Manager</span>
                  <span>manager@exfin.com</span>
                  <span className="block text-slate-400 font-mono">manager123</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-700 block">Employee</span>
                  <span>employee@exfin.com</span>
                  <span className="block text-slate-400 font-mono">employee123</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

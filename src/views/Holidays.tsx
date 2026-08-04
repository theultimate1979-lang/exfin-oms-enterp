import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/date';
import { CalendarDays, Plus, Tag, Clock, Calendar } from 'lucide-react';
import { Holiday } from '../types';
import { motion } from 'motion/react';

export const Holidays: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  // Creation State
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<'National' | 'Company' | 'Weekly Off'>('National');
  const [submitting, setSubmitting] = useState(false);

  const isAdminOrHR = profile?.role && ['Super Admin', 'HR Admin'].includes(profile.role);

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'holidays'), orderBy('date', 'asc'));
      const snap = await getDocs(q);
      const list: Holiday[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as Holiday);
      });
      setHolidays(list);
    } catch (err) {
      console.error(err);
      showToast('Error synchronizing holidays calendar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, []);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date) {
      showToast('Please satisfy all required fields.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const newHoliday = {
        name: name.trim(),
        date,
        type
      };

      await addDoc(collection(db, 'holidays'), newHoliday);
      showToast(`Holiday "${name}" successfully listed.`, 'success');
      
      setName('');
      setDate('');
      setType('National');
      setFormOpen(false);
      loadHolidays();
    } catch (e) {
      console.error(e);
      showToast('Failed to list holiday.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium text-xs">Syncing holiday roster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Holidays & Company Calendar</h1>
          <p className="text-sm text-slate-500 font-medium">Verify upcoming non-working occurrences and business events</p>
        </div>
        {isAdminOrHR && (
          <button
            onClick={() => setFormOpen(!formOpen)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {formOpen ? 'Close Portal' : 'Register Holiday Event'}
          </button>
        )}
      </div>

      {/* Add Holiday Form */}
      {formOpen && isAdminOrHR && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md"
        >
          <h2 className="text-base font-bold text-slate-900 mb-4">Register Holiday Event</h2>
          <form onSubmit={handleAddHoliday} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase">Occurrence Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Independence Day"
                className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase">Target Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase">Holiday Classification</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="mt-1 block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              >
                <option value="National">National Holiday</option>
                <option value="Company">Company Holiday</option>
                <option value="Weekly Off">Weekly Off</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs py-2.5 rounded-lg shadow cursor-pointer transition-all"
            >
              {submitting ? 'Registering...' : 'List Calendar Occurrence'}
            </button>

          </form>
        </motion.div>
      )}

      {/* Roster Listing */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Corporate Scheduled Rest Dates</h3>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-600">
            {holidays.length} Event occurrences mapped
          </span>
        </div>

        {holidays.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-pulse" />
            <p className="text-slate-500 font-bold text-sm">No rest periods populated in the calendar.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {holidays.map((hol) => (
              <div key={hol.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl border border-slate-200">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">{hol.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase">
                        <Tag className="w-3 h-3" />
                        {hol.type} Holiday
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-mono text-xs font-bold">
                    {formatDate(hol.date)}
                  </span>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
};

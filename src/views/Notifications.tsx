import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where,
  orderBy,
  writeBatch 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatDate, formatTime } from '../utils/date';
import { Bell, BellOff, Check, CheckSquare, Trash2, Calendar, ClipboardList, Info, Clock } from 'lucide-react';
import { Notification } from '../types';

export const Notifications: React.FC<{ setUnreadCount: (count: number) => void }> = ({ setUnreadCount }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'notifications'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list: Notification[] = [];
      let unread = 0;

      snap.forEach(d => {
        const item = d.data() as Notification;
        item.id = d.id;
        // Filter in application-space for perfect performance and flexibility
        if (item.userId === 'ALL' || item.userId === user.uid) {
          list.push(item);
          if (!item.read) unread++;
        }
      });

      setNotifications(list);
      setUnreadCount(unread);
    } catch (err) {
      console.error(err);
      showToast('Error syncing announcements logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      
      // Re-calculate unread count
      const newUnread = notifications.filter(n => !n.read && n.id !== id).length;
      setUnreadCount(newUnread);

      showToast('Notification marked as read.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Action failed.', 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadNotifications.forEach(n => {
        batch.update(doc(db, 'notifications', n.id!), { read: true });
      });
      await batch.commit();

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      showToast('All notifications marked as read.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Bulk update failed.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium text-xs">Syncing notifications board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Announcements & Notifications</h1>
          <p className="text-sm text-slate-500 font-medium">Verify system broadcast feeds and your personal duty alerts</p>
        </div>
        {notifications.some(n => !n.read) && (
          <button
            onClick={handleMarkAllAsRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl cursor-pointer transition-all"
          >
            <CheckSquare className="w-4 h-4" />
            Mark All as Read
          </button>
        )}
      </div>

      {/* Notifications container list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <BellOff className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-slate-600 font-bold text-sm">Your alert board is currently pristine.</p>
            <p className="text-xs text-slate-400 font-medium">Any upcoming schedules or leave approvals will display here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((item) => (
              <div 
                key={item.id} 
                className={`p-5 flex items-start justify-between gap-4 transition-all ${item.read ? 'bg-white opacity-70' : 'bg-indigo-50/20'}`}
              >
                <div className="flex items-start gap-4">
                  {/* Categorical Icon Indicator */}
                  <div className={`p-3 rounded-2xl flex-shrink-0 mt-0.5 border ${
                    item.type === 'AttendanceAlert' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                    item.type === 'LeaveApproval' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    'bg-blue-50 text-blue-600 border-blue-100'
                  }`}>
                    {item.type === 'AttendanceAlert' ? <Clock className="w-5 h-5" /> :
                     item.type === 'LeaveApproval' ? <ClipboardList className="w-5 h-5" /> :
                     <Info className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-900 text-sm leading-tight">{item.title}</h4>
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0 animate-pulse"></span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 font-semibold mt-1 leading-relaxed max-w-2xl">{item.message}</p>
                    <span className="text-[10px] text-slate-400 block mt-2 font-bold uppercase tracking-wide">
                      {formatDate(item.createdAt)} at {formatTime(item.createdAt)}
                    </span>
                  </div>
                </div>

                {!item.read && (
                  <button
                    onClick={() => handleMarkAsRead(item.id!)}
                    className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl cursor-pointer transition-colors"
                    title="Mark as Read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

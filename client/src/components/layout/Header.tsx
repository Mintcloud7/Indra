import React, { useState, useEffect, useRef } from 'react';
import { Bell, Menu, LogOut, User, ChevronDown, CheckCheck, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Notification } from '../../api/types';
import { Link, useNavigate } from 'react-router-dom';

interface HeaderProps {
  onMenuClick: () => void;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNotifLink(n: Notification): string | null {
  if (n.link) return n.link;
  if (!n.referenceType || !n.referenceId) return null;
  const map: Record<string, string> = {
    WORK_ORDER: '/work-orders',
    SPARE_PART: '/inventory/spare-parts',
    ASSET: '/assets',
    PREVENTIVE_MAINTENANCE: '/preventive-maintenance',
    PURCHASE_REQUISITION: '/inventory/purchase-requisitions',
    LOG_BOOK: '/log-books',
  };
  const base = map[n.referenceType];
  return base ? `${base}/${n.referenceId}` : null;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get<{ data: Notification[]; total: number }>('/notifications?limit=10');
      setNotifications(res.data || []);
    } catch {}
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get<{ count: number }>('/notifications/unread-count');
      setUnreadCount(res.count || 0);
    } catch {}
  };

  useEffect(() => {
    fetchUnreadCount();
  }, []);

  useEffect(() => {
    if (showNotifPopup) {
      fetchNotifications();
    }
  }, [showNotifPopup]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPopup(false);
      }
    };
    if (showNotifPopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifPopup]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5 text-slate-600" />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-4">
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifPopup(!showNotifPopup)}
            className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Bell className="h-5 w-5 text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifPopup && (
            <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-lg border border-slate-200 z-50 max-h-[480px] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    No notifications
                  </div>
                ) : (
                  notifications.map((n) => {
                    const link = getNotifLink(n);
                    return (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.isRead) handleMarkAsRead(n.id);
                        if (link) {
                          navigate(link);
                          setShowNotifPopup(false);
                        }
                      }}
                      className={`px-4 py-3 transition-colors ${
                        link ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50'
                      } ${!n.isRead ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.isRead ? 'font-medium text-slate-900' : 'text-slate-700'} ${link ? 'hover:text-blue-600' : ''}`}>
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{n.message}</p>
                          <p className="text-xs text-slate-400 mt-1">{formatDate(n.createdAt)}</p>
                        </div>
                        {!n.isRead && (
                          <button
                            onClick={() => handleMarkAsRead(n.id)}
                            className="mt-1 p-1 text-slate-400 hover:text-blue-600 rounded shrink-0"
                            title="Mark as read"
                          >
                            <div className="h-2 w-2 bg-blue-500 rounded-full" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                  })
                )}
              </div>

              <Link
                to="/notifications"
                onClick={() => setShowNotifPopup(false)}
                className="block text-center text-sm text-blue-600 hover:text-blue-700 py-2.5 border-t border-slate-200"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">
              {user?.name || 'User'}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
                <Link
                  to="/admin/account"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Settings className="h-4 w-4" />
                  Account Settings
                </Link>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

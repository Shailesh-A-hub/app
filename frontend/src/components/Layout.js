import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { LayoutDashboard, ShieldAlert, FileLock, Mail, Radar, Settings, FileText, Users, LogOut, Shield, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from 'sonner';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Command Center' },
  { to: '/war-room', icon: ShieldAlert, label: 'War Room' },
  { to: '/evidence', icon: FileLock, label: 'Evidence Locker' },
  { to: '/mailbox', icon: Mail, label: 'Mailbox' },
  { to: '/attack-vector', icon: Radar, label: 'Attack Vector' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/reports', icon: FileText, label: 'Reports Sent' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }) {
  const { breachState, logout, adminEmail, theme, toggleTheme } = useApp();
  const navigate = useNavigate();
  const isBreaching = breachState?.active;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden" data-testid="app-layout">
      <Toaster position="top-right" richColors theme={theme} />
      {/* Sidebar */}
      <aside className="w-64 bg-[#0F172A] border-r border-gray-800 flex flex-col fixed left-0 top-0 h-full z-40" data-testid="sidebar">
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isBreaching ? 'bg-red-900/30 border border-red-800' : 'bg-blue-900/30 border border-blue-800'}`}>
              <Shield className={`w-6 h-6 ${isBreaching ? 'text-red-400' : 'text-blue-400'}`} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-gray-100" style={{ fontFamily: 'Chivo' }}>DPDP SHIELD</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Prevent &middot; Detect &middot; Respond</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-900/50'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`
              }
              data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
              {label}
              {label === 'War Room' && isBreaching && (
                <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-blink" />
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800 space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 truncate">
            <div className="w-6 h-6 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400 text-[10px] font-bold">A</div>
            <span className="truncate">{adminEmail}</span>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-gray-400 hover:text-white" onClick={handleLogout} data-testid="logout-btn">
            <LogOut className="w-4 h-4 mr-2" strokeWidth={1.5} /> Logout
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-64 flex flex-col h-screen">
        {/* Header */}
        <header className={`h-14 border-b border-gray-800 flex items-center justify-between px-6 sticky top-0 z-30 backdrop-blur-md ${isBreaching ? 'breach-header bg-[#0B1220]/90' : 'bg-[#0B1220]/80'}`} data-testid="app-header">
          <div className="flex items-center gap-3">
            {isBreaching ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-900/30 border border-red-800 rounded text-red-400 text-xs font-semibold uppercase tracking-wider animate-blink" data-testid="breach-status-pill">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Active Breach &mdash; {breachState.incident_id}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-900/30 border border-emerald-800 rounded text-emerald-400 text-xs font-semibold uppercase tracking-wider" data-testid="secure-status-pill">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                System Secure
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400" onClick={toggleTheme} data-testid="theme-toggle">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-[var(--bg-main)]" style={{ backgroundColor: 'hsl(var(--background))' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

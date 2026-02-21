import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Settings, Sun, Moon, Shield, Zap, AlertTriangle, Users, Eye, EyeOff, Mail, CheckCircle2, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';

export default function SettingsPage() {
  const { API, authHeaders, theme, toggleTheme } = useApp();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [gmailStatus, setGmailStatus] = useState({ connected: false, error: '' });
  const [gmailPassword, setGmailPassword] = useState('');
  const [gmailSaving, setGmailSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [settRes, gmailRes] = await Promise.all([
          axios.get(`${API}/settings`, authHeaders()),
          axios.get(`${API}/emails/connection-status`, authHeaders()),
        ]);
        setSettings(settRes.data);
        setGmailStatus(gmailRes.data);
      } catch {}
    };
    fetch();
  }, [API, authHeaders]);

  const updateGmailPassword = async () => {
    if (!gmailPassword.trim()) return toast.error('Enter an App Password');
    setGmailSaving(true);
    try {
      const res = await axios.post(`${API}/settings/gmail-password`, { password: gmailPassword.trim() }, authHeaders());
      if (res.data.ok) {
        toast.success('Gmail connected successfully!');
        setGmailStatus({ connected: true, error: '' });
        setGmailPassword('');
      } else {
        toast.error(res.data.error || 'Connection failed');
        setGmailStatus({ connected: false, error: res.data.error });
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    } finally { setGmailSaving(false); }
  };

  const updateSetting = async (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, updated, authHeaders());
      toast.success('Settings updated');
    } catch {
      toast.error('Failed to save settings');
    } finally { setSaving(false); }
  };

  const updateIntegration = async (key, value) => {
    const integrations = { ...settings?.integrations, [key]: value };
    const updated = { ...settings, integrations };
    setSettings(updated);
    try {
      await axios.put(`${API}/settings`, updated, authHeaders());
      toast.success('Integration updated');
    } catch {}
  };

  if (!settings) {
    return <div className="h-48 skeleton-shimmer rounded-lg" />;
  }

  return (
    <div className="space-y-6 max-w-4xl" data-testid="settings-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-400" /> Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Configuration, integrations, and simulation controls</p>
      </div>

      {/* Theme */}
      <Card className="bg-[#111827] border-gray-800" data-testid="theme-settings">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-gray-400">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="w-5 h-5 text-blue-400" /> : <Sun className="w-5 h-5 text-amber-400" />}
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="text-xs text-gray-500">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</p>
              </div>
            </div>
            <Switch checked={theme === 'light'} onCheckedChange={toggleTheme} data-testid="theme-switch" />
          </div>
        </CardContent>
      </Card>

      {/* Gmail Integration */}
      <Card className={`border-gray-800 ${gmailStatus.connected ? 'bg-[#111827]' : 'bg-[#111827] border-l-4 border-l-red-500'}`} data-testid="gmail-settings">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Mail className="w-4 h-4" /> Gmail Integration
            </CardTitle>
            <Badge className={gmailStatus.connected ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' : 'bg-red-950/50 text-red-400 border-red-900/50'}>
              {gmailStatus.connected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">Gmail Account</p>
              <p className="text-xs text-gray-500 font-mono">{gmailStatus.email || 'Dpdp210226@gmail.com'}</p>
            </div>
          </div>
          {!gmailStatus.connected && (
            <>
              {gmailStatus.error && (
                <div className="bg-red-900/20 border border-red-900/30 rounded px-3 py-2 text-xs text-red-400">
                  <AlertTriangle className="w-3 h-3 inline mr-1" /> {gmailStatus.error}
                </div>
              )}
              <div className="bg-[#1F2937] rounded-lg p-4 space-y-3">
                <p className="text-xs text-gray-400">Gmail requires an <strong className="text-white">App Password</strong> for IMAP/SMTP access:</p>
                <ol className="text-xs text-gray-500 ml-4 list-decimal space-y-1">
                  <li>Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-blue-400 underline">Google Account &gt; Security</a></li>
                  <li>Enable <strong>2-Step Verification</strong> if not already enabled</li>
                  <li>Search for <strong>App Passwords</strong> and generate one for "Mail"</li>
                  <li>Paste the 16-character App Password below</li>
                </ol>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="password"
                    value={gmailPassword}
                    onChange={e => setGmailPassword(e.target.value)}
                    placeholder="Enter 16-character App Password"
                    className="bg-[#0F172A] border-gray-700 text-white flex-1 font-mono"
                    data-testid="gmail-password-input"
                  />
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={updateGmailPassword} disabled={gmailSaving} data-testid="save-gmail-btn">
                    <Key className="w-4 h-4 mr-1.5" /> {gmailSaving ? 'Connecting...' : 'Connect'}
                  </Button>
                </div>
              </div>
            </>
          )}
          {gmailStatus.connected && (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Gmail IMAP/SMTP connected and ready for email operations
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card className="bg-[#111827] border-gray-800" data-testid="integrations-settings">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-gray-400">Integrations (Demo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'zoho', label: 'Zoho CRM', desc: 'Sync customer data with Zoho CRM' },
            { key: 'whatsapp', label: 'WhatsApp Business', desc: 'Send breach notifications via WhatsApp' },
            { key: 'cloudwatch', label: 'AWS CloudWatch', desc: 'Import security logs and alerts' },
            { key: 'tally', label: 'Tally', desc: 'Financial compliance reporting' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
              <Switch checked={settings.integrations?.[key] || false} onCheckedChange={v => updateIntegration(key, v)} data-testid={`toggle-${key}`} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Roles & Permissions */}
      <Card className="bg-[#111827] border-gray-800" data-testid="roles-settings">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-gray-400">Roles & Permissions (Demo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-800/30">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-red-400" />
              <div><p className="text-sm font-medium">Admin</p><p className="text-xs text-gray-500">Full access to all features</p></div>
            </div>
            <Badge className="bg-red-950/50 text-red-400 border-red-900/50">Full Access</Badge>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-800/30">
            <div className="flex items-center gap-3">
              <Eye className="w-4 h-4 text-blue-400" />
              <div><p className="text-sm font-medium">Compliance Officer</p><p className="text-xs text-gray-500">Read-only, masked PII data</p></div>
            </div>
            <Badge className="bg-blue-950/50 text-blue-400 border-blue-900/50">Read Only</Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <div><p className="text-sm font-medium">IT Operations</p><p className="text-xs text-gray-500">Logs access + containment actions</p></div>
            </div>
            <Badge className="bg-amber-950/50 text-amber-400 border-amber-900/50">Limited</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Simulation Toggles */}
      <Card className="bg-[#111827] border-gray-800 border-l-4 border-l-amber-500" data-testid="simulation-settings">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Simulation Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-500">Toggle these to simulate attack signals in the Attack Vector analysis.</p>
          <div className="flex items-center justify-between py-2">
            <div><p className="text-sm font-medium">Simulate Leaked API Key</p><p className="text-xs text-gray-500">Triggers unusual IP + API security warnings</p></div>
            <Switch checked={settings.sim_leaked_api_key || false} onCheckedChange={v => updateSetting('sim_leaked_api_key', v)} data-testid="toggle-sim-api-key" />
          </div>
          <div className="flex items-center justify-between py-2">
            <div><p className="text-sm font-medium">Simulate Mailbox Forwarding Rule</p><p className="text-xs text-gray-500">Triggers email security warnings</p></div>
            <Switch checked={settings.sim_mailbox_forwarding || false} onCheckedChange={v => updateSetting('sim_mailbox_forwarding', v)} data-testid="toggle-sim-forwarding" />
          </div>
          <div className="flex items-center justify-between py-2">
            <div><p className="text-sm font-medium">Simulate Mass Download Anomaly</p><p className="text-xs text-gray-500">Triggers API rate limit + mass download warnings</p></div>
            <Switch checked={settings.sim_mass_download || false} onCheckedChange={v => updateSetting('sim_mass_download', v)} data-testid="toggle-sim-mass-download" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

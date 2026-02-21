import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ShieldCheck, ShieldAlert, Lock, Wifi, Activity, AlertTriangle, CheckCircle2, Users, FileText, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function CommandCenter() {
  const { API, authHeaders, breachState, fetchBreachStatus } = useApp();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [showBreachDialog, setShowBreachDialog] = useState(false);
  const [breachForm, setBreachForm] = useState({
    nature: 'Unauthorized access to personal data',
    systems: 'Customer Database, Email Server',
    categories: 'Name, Email, Phone Number',
    affected_count: 30,
    description: 'A potential data breach has been detected involving unauthorized access to the customer database.',
  });
  const [triggering, setTriggering] = useState(false);
  const isBreaching = breachState?.active;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API}/dashboard/stats`, authHeaders());
        setStats(res.data);
      } catch {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, isBreaching ? 2000 : 10000);
    return () => clearInterval(interval);
  }, [API, authHeaders, isBreaching]);

  const triggerBreach = async () => {
    setTriggering(true);
    try {
      await axios.post(`${API}/breach/trigger`, breachForm, authHeaders());
      toast.success('Breach protocol activated');
      await fetchBreachStatus();
      setShowBreachDialog(false);
      navigate('/war-room');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to trigger breach');
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="command-center">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time system overview and incident management</p>
        </div>
        {isBreaching && (
          <Badge className="bg-red-900/30 text-red-400 border-red-800 px-3 py-1 text-xs uppercase tracking-wider animate-blink" data-testid="breach-badge">Active Breach</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#111827] border-gray-800" data-testid="stat-customers">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Total Customers</p>
                <p className="text-2xl font-bold mt-1 font-mono">{stats?.total_customers ?? '...'}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500/30" />
            </div>
            <p className="text-xs text-gray-500 mt-2">{stats?.active_customers ?? 0} active</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111827] border-gray-800" data-testid="stat-reports">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Reports Generated</p>
                <p className="text-2xl font-bold mt-1 font-mono">{stats?.total_reports ?? '...'}</p>
              </div>
              <FileText className="w-8 h-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111827] border-gray-800" data-testid="stat-requests">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">DPDP Requests</p>
                <p className="text-2xl font-bold mt-1 font-mono">{stats?.total_requests ?? '...'}</p>
              </div>
              <Mail className="w-8 h-8 text-amber-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className={`border-gray-800 ${isBreaching ? 'bg-red-900/10 border-red-900/50' : 'bg-[#111827]'}`} data-testid="stat-breach">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Breach Status</p>
                <p className={`text-lg font-bold mt-1 ${isBreaching ? 'text-red-400' : 'text-emerald-400'}`}>{isBreaching ? 'ACTIVE' : 'SECURE'}</p>
              </div>
              {isBreaching ? <ShieldAlert className="w-8 h-8 text-red-500/50" /> : <ShieldCheck className="w-8 h-8 text-emerald-500/30" />}
            </div>
            {isBreaching && <p className="text-xs text-red-400/70 mt-2 font-mono">{breachState.incident_id}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Monitor */}
        <Card className="bg-[#111827] border-gray-800" data-testid="health-monitor">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-gray-400 font-semibold">Health Monitor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
              <div className="flex items-center gap-2"><Lock className="w-4 h-4 text-emerald-400" strokeWidth={1.5} /><span className="text-sm">Database Encryption</span></div>
              <Badge className="bg-emerald-950/50 text-emerald-400 border-emerald-900/50">Active</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
              <div className="flex items-center gap-2"><Wifi className="w-4 h-4 text-emerald-400" strokeWidth={1.5} /><span className="text-sm">TLS 1.2+</span></div>
              <Badge className="bg-emerald-950/50 text-emerald-400 border-emerald-900/50">Active</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
              <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-amber-400" strokeWidth={1.5} /><span className="text-sm">Anomalies (24h)</span></div>
              <span className="font-mono text-sm text-amber-400">{isBreaching ? '3' : '0'}</span>
            </div>
            <div className="mt-3 bg-[#1F2937] rounded p-3">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Traffic (simulated)</p>
              <div className="flex items-end gap-1 h-10">
                {[40,65,55,70,45,80,60,75,50,90,55,70].map((h, i) => (
                  <div key={i} className="flex-1 bg-blue-600/30 rounded-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panic Button */}
        <Card className="bg-[#111827] border-gray-800 flex flex-col items-center justify-center" data-testid="panic-section">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            {isBreaching ? (
              <>
                <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
                <h3 className="text-lg font-bold text-red-400 mb-2">Breach Protocol Active</h3>
                <p className="text-sm text-gray-500 mb-4">Incident {breachState.incident_id} in progress</p>
                <Button className="bg-red-600 hover:bg-red-700" onClick={() => navigate('/war-room')} data-testid="go-war-room-btn">
                  Go to War Room
                </Button>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <div className="w-28 h-28 rounded-full border-4 border-red-600/30 flex items-center justify-center cursor-pointer animate-pulse-danger hover:border-red-600/60 transition-all" onClick={() => setShowBreachDialog(true)} data-testid="panic-button">
                    <div className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-red-900/30">
                      <ShieldAlert className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
                <h3 className="text-base font-bold text-gray-300 mb-1">Trigger Breach Protocol</h3>
                <p className="text-xs text-gray-500 max-w-[240px]">Initiate incident response. 72-hour DPB notification countdown begins.</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Readiness Checklist */}
        <Card className="bg-[#111827] border-gray-800" data-testid="readiness-checklist">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-gray-400 font-semibold">Readiness Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-sm">DPB Templates Ready</span></div>
              <Badge className="bg-emerald-950/50 text-emerald-400 border-emerald-900/50">Ready</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-sm">User Contacts Loaded</span></div>
              <span className="font-mono text-sm text-emerald-400">{stats?.active_customers ?? 0}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
              <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /><span className="text-sm">Staff Training</span></div>
              <Badge className="bg-amber-950/50 text-amber-400 border-amber-900/50">Pending</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-sm">CSV Logging Active</span></div>
              <Badge className="bg-emerald-950/50 text-emerald-400 border-emerald-900/50">Active</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-sm">PDF Generation</span></div>
              <Badge className="bg-emerald-950/50 text-emerald-400 border-emerald-900/50">Online</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breach Trigger Dialog */}
      <Dialog open={showBreachDialog} onOpenChange={setShowBreachDialog}>
        <DialogContent className="bg-[#111827] border-gray-800 text-gray-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> Trigger Breach Protocol</DialogTitle>
            <DialogDescription className="text-gray-500">This will activate the 72-hour DPB notification countdown. Fill in incident details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider">Nature of Breach</label>
              <Input value={breachForm.nature} onChange={e => setBreachForm(f => ({ ...f, nature: e.target.value }))} className="bg-[#1F2937] border-gray-700 text-white mt-1" data-testid="breach-nature-input" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider">Systems Impacted</label>
              <Input value={breachForm.systems} onChange={e => setBreachForm(f => ({ ...f, systems: e.target.value }))} className="bg-[#1F2937] border-gray-700 text-white mt-1" data-testid="breach-systems-input" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider">Affected Users Count</label>
              <Input type="number" value={breachForm.affected_count} onChange={e => setBreachForm(f => ({ ...f, affected_count: parseInt(e.target.value) || 0 }))} className="bg-[#1F2937] border-gray-700 text-white mt-1" data-testid="breach-count-input" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider">Description</label>
              <Textarea value={breachForm.description} onChange={e => setBreachForm(f => ({ ...f, description: e.target.value }))} className="bg-[#1F2937] border-gray-700 text-white mt-1" rows={3} data-testid="breach-desc-input" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" className="border-gray-700 text-gray-400" onClick={() => setShowBreachDialog(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={triggerBreach} disabled={triggering} data-testid="confirm-breach-btn">
              {triggering ? 'Activating...' : 'Activate Breach Protocol'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

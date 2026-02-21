import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import axios from 'axios';
import { toast } from 'sonner';
import { ShieldAlert, Clock, CheckCircle2, Circle, Download, Send, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STEPS = ['Intake', 'Containment', 'Notify DPB', 'Notify Users', 'Close'];
const API_BASE = process.env.REACT_APP_BACKEND_URL;

export default function WarRoom() {
  const { API, authHeaders, breachState, fetchBreachStatus } = useApp();
  const isBreaching = breachState?.active;
  const [remaining, setRemaining] = useState({ h: 71, m: 59, s: 59 });
  const [channel, setChannel] = useState('EMAIL');
  const [loading, setLoading] = useState({});

  // Timer countdown
  useEffect(() => {
    if (!isBreaching || !breachState.discovery_time) return;
    const calcRemaining = () => {
      const disc = new Date(breachState.discovery_time);
      const deadline = new Date(disc.getTime() + 72 * 60 * 60 * 1000);
      const diff = deadline - new Date();
      if (diff <= 0) return { h: 0, m: 0, s: 0 };
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      return { h, m, s };
    };
    setRemaining(calcRemaining());
    const timer = setInterval(() => setRemaining(calcRemaining()), 1000);
    return () => clearInterval(timer);
  }, [isBreaching, breachState.discovery_time]);

  const doAction = useCallback(async (action, key) => {
    setLoading(l => ({ ...l, [key]: true }));
    try {
      let res;
      if (action === 'contain') {
        res = await axios.post(`${API}/breach/contain`, {}, authHeaders());
        toast.success('Containment confirmed');
      } else if (action === 'dpb') {
        res = await axios.post(`${API}/breach/dpb-notice`, {}, authHeaders());
        toast.success('DPB Notice generated');
      } else if (action === 'notify') {
        res = await axios.post(`${API}/breach/notify-users`, { channel }, authHeaders());
        toast.success(`Notifications sent to ${res.data.count} users`);
      } else if (action === 'close') {
        res = await axios.post(`${API}/breach/close`, {}, authHeaders());
        toast.success('Incident closed. Audit report generated.');
      }
      await fetchBreachStatus();
      return res?.data;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    } finally {
      setLoading(l => ({ ...l, [key]: false }));
    }
  }, [API, authHeaders, channel, fetchBreachStatus]);

  const downloadPdf = (filename) => {
    window.open(`${API_BASE}/api/pdf/${filename}`, '_blank');
    toast.success('PDF downloaded');
  };

  const currentStep = breachState?.step || 0;

  if (!isBreaching && !breachState?.closed) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center" data-testid="war-room-idle">
        <ShieldAlert className="w-16 h-16 text-gray-700 mb-4" />
        <h2 className="text-xl font-bold text-gray-400 mb-2">No Active Breach</h2>
        <p className="text-sm text-gray-600 max-w-md">The War Room activates when a breach protocol is triggered from the Command Center. All systems are currently secure.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="war-room">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-400" /> War Room
          </h1>
          <p className="text-sm text-gray-500 mt-1">Incident {breachState.incident_id} &mdash; Active Response</p>
        </div>
      </div>

      {/* Timer */}
      {isBreaching && (
        <Card className="bg-red-900/10 border-red-900/30" data-testid="breach-timer">
          <CardContent className="py-8 text-center">
            <p className="text-xs uppercase tracking-widest text-red-400/70 mb-2 font-semibold">Time Remaining to Notify DPB</p>
            <div className="font-mono text-6xl font-bold text-red-400 tracking-widest timer-glow tabular-nums" data-testid="countdown-timer">
              {String(remaining.h).padStart(2, '0')}:{String(remaining.m).padStart(2, '0')}:{String(remaining.s).padStart(2, '0')}
            </div>
            <p className="text-xs text-gray-500 mt-3">72-hour deadline under DPDP Act Section 8(6)</p>
          </CardContent>
        </Card>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2" data-testid="breach-stepper">
        {STEPS.map((step, i) => {
          const stepNum = i + 1;
          const done = currentStep > stepNum;
          const active = currentStep === stepNum;
          return (
            <React.Fragment key={step}>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap ${done ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-900/30' : active ? 'bg-blue-900/20 text-blue-400 border border-blue-800/50' : 'bg-gray-900/50 text-gray-600 border border-gray-800'}`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                <span className="font-medium">{step}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 h-px ${done ? 'bg-emerald-600' : 'bg-gray-700'}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Incident Details */}
      <Card className="bg-[#111827] border-gray-800" data-testid="incident-details">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-gray-400">Incident Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-500 text-xs uppercase tracking-wider block">Discovery</span><span className="font-mono text-xs">{breachState.discovery_time ? new Date(breachState.discovery_time).toLocaleString() : 'N/A'}</span></div>
            <div><span className="text-gray-500 text-xs uppercase tracking-wider block">Nature</span><span className="text-xs">{breachState.nature || 'N/A'}</span></div>
            <div><span className="text-gray-500 text-xs uppercase tracking-wider block">Systems</span><span className="text-xs">{breachState.systems || 'N/A'}</span></div>
            <div><span className="text-gray-500 text-xs uppercase tracking-wider block">Data Categories</span><span className="text-xs">{breachState.categories || 'N/A'}</span></div>
            <div><span className="text-gray-500 text-xs uppercase tracking-wider block">Affected Users</span><span className="font-mono text-xs text-amber-400">{breachState.affected_count || 0}</span></div>
            <div><span className="text-gray-500 text-xs uppercase tracking-wider block">Status</span>
              {breachState.closed ? <Badge className="bg-emerald-950/50 text-emerald-400 border-emerald-900/50">Closed</Badge> :
              <Badge className="bg-red-950/50 text-red-400 border-red-900/50">Active</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Cards */}
      {isBreaching && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Containment */}
          <Card className={`border-gray-800 ${breachState.containment_confirmed ? 'bg-emerald-900/5 border-emerald-900/30' : 'bg-[#111827]'}`} data-testid="containment-card">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Containment</h3>
              <ul className="space-y-2 text-sm text-gray-400 mb-4">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Revoke compromised credentials</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Isolate affected systems</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Preserve evidence logs</li>
              </ul>
              <Button
                className={breachState.containment_confirmed ? 'bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700'}
                onClick={() => doAction('contain', 'contain')}
                disabled={breachState.containment_confirmed || loading.contain}
                data-testid="confirm-containment-btn"
              >
                {breachState.containment_confirmed ? 'Containment Confirmed' : loading.contain ? 'Confirming...' : 'Confirm Containment'}
              </Button>
            </CardContent>
          </Card>

          {/* DPB Notice */}
          <Card className={`border-gray-800 ${breachState.dpb_sent ? 'bg-emerald-900/5 border-emerald-900/30' : 'bg-[#111827]'}`} data-testid="dpb-notice-card">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">DPB Notice</h3>
              <p className="text-xs text-gray-500 mb-4">Generate and send Data Protection Board notice as per Section 8(6).</p>
              <Button
                className={breachState.dpb_sent ? 'bg-emerald-700 text-white' : 'bg-amber-600 hover:bg-amber-700'}
                onClick={async () => {
                  const data = await doAction('dpb', 'dpb');
                  if (data?.filename) downloadPdf(data.filename);
                }}
                disabled={breachState.dpb_sent || loading.dpb}
                data-testid="generate-dpb-btn"
              >
                {breachState.dpb_sent ? 'DPB Notice Generated' : loading.dpb ? 'Generating...' : 'Generate DPB Notice'}
              </Button>
            </CardContent>
          </Card>

          {/* User Alerts */}
          <Card className={`border-gray-800 ${breachState.users_notified ? 'bg-emerald-900/5 border-emerald-900/30' : 'bg-[#111827]'}`} data-testid="user-alerts-card">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">User Notifications</h3>
              <div className="flex items-center gap-2 mb-4">
                <Select value={channel} onValueChange={setChannel} data-testid="channel-select">
                  <SelectTrigger className="w-32 bg-[#1F2937] border-gray-700 text-white h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1F2937] border-gray-700">
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-gray-500">to {breachState.affected_count || 0} users</span>
              </div>
              <Button
                className={breachState.users_notified ? 'bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700'}
                onClick={() => doAction('notify', 'notify')}
                disabled={breachState.users_notified || loading.notify}
                data-testid="broadcast-btn"
              >
                <Send className="w-4 h-4 mr-2" />
                {breachState.users_notified ? 'Users Notified' : loading.notify ? 'Broadcasting...' : `Broadcast to ${breachState.affected_count || 0} Users`}
              </Button>
            </CardContent>
          </Card>

          {/* Close Incident */}
          <Card className="bg-[#111827] border-gray-800" data-testid="close-incident-card">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Close Incident</h3>
              <p className="text-xs text-gray-500 mb-4">Generate audit report and close this incident. This action is final.</p>
              <Button
                className="bg-gray-700 hover:bg-gray-600 text-white"
                onClick={async () => {
                  const data = await doAction('close', 'close');
                  if (data?.filename) downloadPdf(data.filename);
                }}
                disabled={loading.close}
                data-testid="close-incident-btn"
              >
                {loading.close ? 'Closing...' : 'Generate Audit Report & Close'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Timeline */}
      {breachState?.timeline?.length > 0 && (
        <Card className="bg-[#111827] border-gray-800" data-testid="breach-timeline">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-gray-400">Incident Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {breachState.timeline.map((ev, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm">{ev.event}</p>
                    <p className="text-xs text-gray-500 font-mono">{ev.time ? new Date(ev.time).toLocaleString() : ev.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

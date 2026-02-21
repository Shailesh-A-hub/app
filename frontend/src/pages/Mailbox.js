import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Mail, RefreshCw, Send, CheckCircle2, XCircle, Clock, AlertTriangle, KeyRound, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const STATUS_COLORS = {
  NEW: 'bg-blue-950/50 text-blue-400 border-blue-900/50',
  OTP_SENT: 'bg-amber-950/50 text-amber-400 border-amber-900/50',
  OTP_VERIFIED: 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50',
  COMPLETED: 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50',
  FAILED: 'bg-red-950/50 text-red-400 border-red-900/50',
  NEEDS_INFO: 'bg-amber-950/50 text-amber-400 border-amber-900/50',
  PENDING: 'bg-gray-800 text-gray-400 border-gray-700',
};
const INTENT_COLORS = {
  SHOW: 'bg-blue-950/50 text-blue-400 border-blue-900/50',
  DELETE: 'bg-red-950/50 text-red-400 border-red-900/50',
  CORRECT: 'bg-amber-950/50 text-amber-400 border-amber-900/50',
  UNKNOWN: 'bg-gray-800 text-gray-400 border-gray-700',
};

export default function Mailbox() {
  const { API, authHeaders } = useApp();
  const [emails, setEmails] = useState([]);
  const [mailReplies, setMailReplies] = useState([]);
  const [connected, setConnected] = useState(false);
  const [connError, setConnError] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [otpDialog, setOtpDialog] = useState(null);
  const [otpValue, setOtpValue] = useState('');
  const [correctionDialog, setCorrectionDialog] = useState(null);
  const [correctionData, setCorrectionData] = useState({ new_name: '', new_email: '', new_phone: '' });

  const fetchEmails = useCallback(async () => {
    setRefreshing(true);
    try {
      const [emailRes, repliesRes] = await Promise.all([
        axios.get(`${API}/emails`, authHeaders()),
        axios.get(`${API}/mail-replies`, authHeaders()),
      ]);
      setEmails(emailRes.data.emails || []);
      setConnected(emailRes.data.connected);
      setConnError(emailRes.data.error || '');
      setMailReplies(repliesRes.data || []);
    } catch {} finally { setRefreshing(false); }
  }, [API, authHeaders]);

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 15000);
    return () => clearInterval(interval);
  }, [fetchEmails]);

  const processEmail = async (em) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/emails/process`, {
        email_id: em.id, from_email: em.from_email, subject: em.subject, body: em.body, received_at: em.received_at,
      }, authHeaders());
      toast.success(res.data.message);
      if (res.data.status === 'OTP_SENT') {
        toast.info(`Demo OTP: ${res.data.otp_for_demo}`);
        setOtpDialog({ request_id: res.data.request_id, intent: res.data.intent, customer_id: res.data.customer_id, otp_hint: res.data.otp_for_demo });
      }
      await fetchEmails();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to process email');
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (!otpDialog) return;
    try {
      const res = await axios.post(`${API}/emails/verify-otp`, { request_id: otpDialog.request_id, otp: otpValue }, authHeaders());
      toast.success('OTP verified successfully');
      if (res.data.needs_correction_data) {
        setOtpDialog(null);
        setOtpValue('');
        setCorrectionDialog({ request_id: otpDialog.request_id, customer_id: otpDialog.customer_id });
      } else {
        toast.success(res.data.action || 'Action completed');
        setOtpDialog(null);
        setOtpValue('');
      }
      await fetchEmails();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'OTP verification failed');
    }
  };

  const applyCorrection = async () => {
    if (!correctionDialog) return;
    try {
      const payload = { request_id: correctionDialog.request_id, customer_id: correctionDialog.customer_id };
      if (correctionData.new_name) payload.new_name = correctionData.new_name;
      if (correctionData.new_email) payload.new_email = correctionData.new_email;
      if (correctionData.new_phone) payload.new_phone = correctionData.new_phone;
      const res = await axios.post(`${API}/emails/apply-correction`, payload, authHeaders());
      toast.success('Correction applied and confirmation PDF generated');
      setCorrectionDialog(null);
      setCorrectionData({ new_name: '', new_email: '', new_phone: '' });
      await fetchEmails();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Correction failed');
    }
  };

  const getRequestStatus = (emailItem) => {
    const reply = mailReplies.find(r => r.from_email === emailItem.from_email && r.subject?.includes(emailItem.subject?.substring(0, 20)));
    return reply;
  };

  return (
    <div className="space-y-6" data-testid="mailbox-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-400" /> Mailbox
          </h1>
          <p className="text-sm text-gray-500 mt-1">DPDP data requests via email</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={connected ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' : 'bg-red-950/50 text-red-400 border-red-900/50'} data-testid="gmail-status">
            {connected ? 'Gmail Connected' : 'Gmail Disconnected'}
          </Badge>
          <Button variant="outline" size="sm" className="border-gray-700 text-gray-400" onClick={fetchEmails} disabled={refreshing} data-testid="refresh-emails-btn">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {!connected && connError && (
        <Card className="bg-red-900/10 border-red-900/30" data-testid="gmail-error-banner">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-400">Gmail Not Connected</p>
                <p className="text-xs text-gray-400 mt-1">{connError}</p>
                <p className="text-xs text-gray-500 mt-2">To fix: Go to <span className="text-blue-400">Settings</span> tab and update your Gmail App Password, or follow these steps:</p>
                <ol className="text-xs text-gray-500 mt-1 ml-4 list-decimal space-y-0.5">
                  <li>Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-blue-400 underline">Google Account Security</a></li>
                  <li>Enable 2-Step Verification (if not already)</li>
                  <li>Go to App Passwords and generate a new one for "Mail"</li>
                  <li>Paste the 16-character password in Settings &gt; Gmail App Password</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: '400px', maxHeight: 'calc(100vh - 300px)' }}>
        {/* Email list */}
        <Card className="bg-[#111827] border-gray-800 lg:col-span-1 overflow-hidden" data-testid="email-list">
          <CardHeader className="py-3 px-4 border-b border-gray-800">
            <CardTitle className="text-xs uppercase tracking-wider text-gray-500">Inbox ({emails.length})</CardTitle>
          </CardHeader>
          <ScrollArea className="h-[calc(100%-48px)]">
            <div className="divide-y divide-gray-800/50">
              {emails.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-600">
                  {connected ? 'No emails found. Send a test email to the connected account.' : 'Connect Gmail to see emails.'}
                </div>
              )}
              {emails.map((em, i) => (
                <div
                  key={em.id || i}
                  className={`p-3 cursor-pointer transition-colors hover:bg-gray-800/50 ${selected?.id === em.id ? 'bg-blue-900/10 border-l-2 border-l-blue-500' : ''}`}
                  onClick={() => setSelected(em)}
                  data-testid={`email-item-${i}`}
                >
                  <p className="text-xs text-gray-500 truncate">{em.from_email}</p>
                  <p className="text-sm font-medium truncate mt-0.5">{em.subject || '(no subject)'}</p>
                  <p className="text-xs text-gray-600 truncate mt-0.5">{em.body?.substring(0, 80)}</p>
                  <p className="text-[10px] text-gray-600 font-mono mt-1">{em.received_at ? new Date(em.received_at).toLocaleString() : ''}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Email detail + actions */}
        <Card className="bg-[#111827] border-gray-800 lg:col-span-2 overflow-hidden" data-testid="email-detail">
          {selected ? (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">{selected.subject || '(no subject)'}</h3>
                    <p className="text-xs text-gray-500 mt-1">From: {selected.from_email} &middot; {selected.received_at ? new Date(selected.received_at).toLocaleString() : ''}</p>
                  </div>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => processEmail(selected)} disabled={loading} data-testid="process-email-btn">
                    <Send className="w-3.5 h-3.5 mr-1.5" /> {loading ? 'Processing...' : 'Process Request'}
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1 p-4">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{selected.body}</pre>
              </ScrollArea>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-600 text-sm">
              Select an email to view details
            </div>
          )}
        </Card>
      </div>

      {/* Processed requests table */}
      {mailReplies.length > 0 && (
        <Card className="bg-[#111827] border-gray-800" data-testid="mail-replies-table">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-gray-400">Processed Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 px-3 text-xs text-gray-500 uppercase tracking-wider">Request ID</th>
                    <th className="text-left py-2 px-3 text-xs text-gray-500 uppercase tracking-wider">From</th>
                    <th className="text-left py-2 px-3 text-xs text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="text-left py-2 px-3 text-xs text-gray-500 uppercase tracking-wider">Intent</th>
                    <th className="text-left py-2 px-3 text-xs text-gray-500 uppercase tracking-wider">OTP</th>
                    <th className="text-left py-2 px-3 text-xs text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mailReplies.map((r, i) => (
                    <tr key={i} className="border-b border-gray-800/30 hover:bg-gray-800/30">
                      <td className="py-2 px-3 font-mono text-xs text-blue-400">{r.request_id}</td>
                      <td className="py-2 px-3 text-xs truncate max-w-[150px]">{r.from_email}</td>
                      <td className="py-2 px-3 font-mono text-xs">{r.customer_id || '-'}</td>
                      <td className="py-2 px-3"><Badge className={`text-[10px] ${INTENT_COLORS[r.intent] || INTENT_COLORS.UNKNOWN}`}>{r.intent}</Badge></td>
                      <td className="py-2 px-3"><Badge className={`text-[10px] ${STATUS_COLORS[r.otp_status] || STATUS_COLORS.PENDING}`}>{r.otp_status}</Badge></td>
                      <td className="py-2 px-3"><Badge className={`text-[10px] ${STATUS_COLORS[r.action_status] || STATUS_COLORS.PENDING}`}>{r.action_status || 'PENDING'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OTP Dialog */}
      <Dialog open={!!otpDialog} onOpenChange={() => { setOtpDialog(null); setOtpValue(''); }}>
        <DialogContent className="bg-[#111827] border-gray-800 text-gray-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-blue-400" /> Verify OTP</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-gray-400">OTP has been sent to the registered email for customer <span className="font-mono text-blue-400">{otpDialog?.customer_id}</span>.</p>
            <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-900/30 rounded px-3 py-2">Demo OTP: <span className="font-mono font-bold">{otpDialog?.otp_hint}</span></p>
            <Input value={otpValue} onChange={e => setOtpValue(e.target.value)} placeholder="Enter 6-digit OTP" className="bg-[#1F2937] border-gray-700 text-white font-mono text-lg text-center tracking-widest" maxLength={6} data-testid="otp-input" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-700 text-gray-400" onClick={() => { setOtpDialog(null); setOtpValue(''); }}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={verifyOtp} disabled={otpValue.length !== 6} data-testid="verify-otp-btn">
              Verify OTP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correction Dialog */}
      <Dialog open={!!correctionDialog} onOpenChange={() => { setCorrectionDialog(null); setCorrectionData({ new_name: '', new_email: '', new_phone: '' }); }}>
        <DialogContent className="bg-[#111827] border-gray-800 text-gray-100">
          <DialogHeader>
            <DialogTitle>Apply Data Correction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-gray-400">Enter the corrected values for customer <span className="font-mono text-blue-400">{correctionDialog?.customer_id}</span>. Leave blank to keep current value.</p>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider">New Name</label>
              <Input value={correctionData.new_name} onChange={e => setCorrectionData(d => ({ ...d, new_name: e.target.value }))} className="bg-[#1F2937] border-gray-700 text-white mt-1" placeholder="Leave blank to keep" data-testid="correction-name-input" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider">New Email</label>
              <Input value={correctionData.new_email} onChange={e => setCorrectionData(d => ({ ...d, new_email: e.target.value }))} className="bg-[#1F2937] border-gray-700 text-white mt-1" placeholder="Leave blank to keep" data-testid="correction-email-input" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider">New Phone</label>
              <Input value={correctionData.new_phone} onChange={e => setCorrectionData(d => ({ ...d, new_phone: e.target.value }))} className="bg-[#1F2937] border-gray-700 text-white mt-1" placeholder="Leave blank to keep" data-testid="correction-phone-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-700 text-gray-400" onClick={() => setCorrectionDialog(null)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={applyCorrection} data-testid="apply-correction-btn">Apply Correction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

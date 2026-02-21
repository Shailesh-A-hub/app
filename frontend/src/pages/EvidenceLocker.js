import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import axios from 'axios';
import { toast } from 'sonner';
import { FileLock, Clock, Download, Eye, EyeOff, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_BASE = process.env.REACT_APP_BACKEND_URL;

export default function EvidenceLocker() {
  const { API, authHeaders, breachState } = useApp();
  const [timeline, setTimeline] = useState([]);
  const [reportsCount, setReportsCount] = useState(0);
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [encData, setEncData] = useState({ raw: [], decrypted: [] });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [tRes, eRes] = await Promise.all([
          axios.get(`${API}/evidence/timeline`, authHeaders()),
          axios.get(`${API}/evidence/encryption-demo`, authHeaders()),
        ]);
        setTimeline(tRes.data.timeline || []);
        setReportsCount(tRes.data.reports_count || 0);
        setEncData(eRes.data);
      } catch {}
    };
    fetch();
  }, [API, authHeaders]);

  const generateAuditReport = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/pdf/audit-report`, {}, authHeaders());
      toast.success('Audit report generated');
      if (res.data.filename) {
        window.open(`${API_BASE}/api/pdf/${res.data.filename}`, '_blank');
        toast.success('PDF logged to reports_sent.csv');
      }
    } catch (err) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const displayData = showDecrypted ? encData.decrypted : encData.raw;

  return (
    <div className="space-y-6" data-testid="evidence-locker">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileLock className="w-6 h-6 text-blue-400" /> Evidence Locker
          </h1>
          <p className="text-sm text-gray-500 mt-1">Audit trail, evidence, and encryption verification</p>
        </div>
        <Button onClick={generateAuditReport} disabled={generating} className="bg-blue-600 hover:bg-blue-700" data-testid="download-audit-btn">
          <Download className="w-4 h-4 mr-2" /> {generating ? 'Generating...' : 'Download Full Audit Report PDF'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline */}
        <Card className="bg-[#111827] border-gray-800" data-testid="evidence-timeline">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Incident Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-8">No events recorded yet. Timeline populates during breach response.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-700" />
                <div className="space-y-4">
                  {timeline.map((ev, i) => (
                    <div key={i} className="flex items-start gap-4 ml-0">
                      <div className={`w-4 h-4 rounded-full flex-shrink-0 mt-0.5 border-2 z-10 ${
                        ev.type === 'trigger' ? 'bg-red-500 border-red-400' :
                        ev.type === 'close' ? 'bg-emerald-500 border-emerald-400' :
                        'bg-blue-500 border-blue-400'
                      }`} />
                      <div>
                        <p className="text-sm font-medium">{ev.event}</p>
                        <p className="text-xs text-gray-500 font-mono">{ev.time ? new Date(ev.time).toLocaleString() : ev.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Encryption Proof */}
        <Card className="bg-[#111827] border-gray-800" data-testid="encryption-proof">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-gray-400">Encryption Proof</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-400 text-xs"
                onClick={() => setShowDecrypted(!showDecrypted)}
                data-testid="toggle-encryption-btn"
              >
                {showDecrypted ? <><EyeOff className="w-3 h-3 mr-1.5" /> View Raw</> : <><Eye className="w-3 h-3 mr-1.5" /> View Decrypted</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Badge className={showDecrypted ? 'bg-amber-950/50 text-amber-400 border-amber-900/50' : 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50'}>
                  {showDecrypted ? 'Decrypted View' : 'Encrypted (Raw)'}
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-2 px-2 text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="text-left py-2 px-2 text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="text-left py-2 px-2 text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="text-left py-2 px-2 text-gray-500 uppercase tracking-wider">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.map((row, i) => (
                      <tr key={i} className="border-b border-gray-800/30">
                        <td className="py-2 px-2 font-mono text-blue-400">{row.customer_id}</td>
                        <td className={`py-2 px-2 ${showDecrypted ? '' : 'font-mono text-gray-600 break-all'}`}>{row.name}</td>
                        <td className={`py-2 px-2 ${showDecrypted ? '' : 'font-mono text-gray-600 break-all'}`}>{row.email}</td>
                        <td className={`py-2 px-2 ${showDecrypted ? '' : 'font-mono text-gray-600 break-all'}`}>{row.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#111827] border-gray-800">
          <CardContent className="p-5 text-center">
            <FileText className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold font-mono">{reportsCount}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Reports Generated</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111827] border-gray-800">
          <CardContent className="p-5 text-center">
            <Clock className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-2xl font-bold font-mono">{timeline.length}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Timeline Events</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111827] border-gray-800">
          <CardContent className="p-5 text-center">
            <FileLock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-2xl font-bold font-mono">AES-256</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Encryption Standard</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Radar, Shield, ShieldAlert, CheckCircle2, AlertTriangle, XCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_BASE = process.env.REACT_APP_BACKEND_URL;

export default function AttackVector() {
  const { API, authHeaders } = useApp();
  const [analysis, setAnalysis] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${API}/attack-vector`, authHeaders());
        setAnalysis(res.data);
      } catch {}
    };
    fetch();
  }, [API, authHeaders]);

  const downloadPdf = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/attack-vector/pdf`, {}, authHeaders());
      if (res.data.filename) {
        window.open(`${API_BASE}/api/pdf/${res.data.filename}`, '_blank');
        toast.success('Vector Analysis PDF generated and logged');
      }
    } catch (err) {
      toast.error('Failed to generate PDF');
    } finally { setGenerating(false); }
  };

  const SignalIcon = ({ ok }) => ok
    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
    : <XCircle className="w-4 h-4 text-red-400" />;

  if (!analysis) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Attack Vector Analysis</h1>
        <div className="grid grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-48 bg-[#111827] border border-gray-800 rounded-lg skeleton-shimmer" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="attack-vector-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Radar className="w-6 h-6 text-blue-400" /> Attack Vector Analysis
          </h1>
          <p className="text-sm text-gray-500 mt-1">Identify potential breach sources and security signals</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={downloadPdf} disabled={generating} data-testid="download-vector-pdf-btn">
          <Download className="w-4 h-4 mr-2" /> {generating ? 'Generating...' : 'Download Vector Analysis PDF'}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#111827] border-gray-800">
          <CardContent className="p-5 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Likely Source</p>
            <p className={`text-xl font-bold ${analysis.likely_source === 'None Detected' ? 'text-emerald-400' : 'text-red-400'}`}>{analysis.likely_source}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111827] border-gray-800">
          <CardContent className="p-5 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Confidence</p>
            <p className="text-xl font-bold text-amber-400">{analysis.confidence}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111827] border-gray-800">
          <CardContent className="p-5 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Risk Score</p>
            <p className="text-xl font-bold font-mono text-blue-400">{analysis.api_score + analysis.email_score}/18</p>
          </CardContent>
        </Card>
      </div>

      {/* Two big cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* API Card */}
        <Card className={`border-gray-800 ${analysis.api_status === 'Insecure' ? 'bg-red-900/5 border-red-900/30' : 'bg-[#111827]'}`} data-testid="api-security-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <Shield className="w-4 h-4" /> API Security
              </CardTitle>
              <Badge className={analysis.api_status === 'Secure' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' : 'bg-red-950/50 text-red-400 border-red-900/50'} data-testid="api-status-badge">
                {analysis.api_status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.api_signals.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-800/30">
                <div className="flex items-center gap-2">
                  <SignalIcon ok={s.ok} />
                  <span className="text-sm">{s.label}</span>
                </div>
                <Badge className={`text-[10px] ${s.ok ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' : s.severity === 'high' ? 'bg-red-950/50 text-red-400 border-red-900/50' : 'bg-amber-950/50 text-amber-400 border-amber-900/50'}`}>
                  {s.ok ? 'PASS' : s.severity.toUpperCase()}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Email Card */}
        <Card className={`border-gray-800 ${analysis.email_status === 'Insecure' ? 'bg-red-900/5 border-red-900/30' : 'bg-[#111827]'}`} data-testid="email-security-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Email Security
              </CardTitle>
              <Badge className={analysis.email_status === 'Secure' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' : 'bg-red-950/50 text-red-400 border-red-900/50'} data-testid="email-status-badge">
                {analysis.email_status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.email_signals.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-800/30">
                <div className="flex items-center gap-2">
                  <SignalIcon ok={s.ok} />
                  <span className="text-sm">{s.label}</span>
                </div>
                <Badge className={`text-[10px] ${s.ok ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' : s.severity === 'high' ? 'bg-red-950/50 text-red-400 border-red-900/50' : 'bg-amber-950/50 text-amber-400 border-amber-900/50'}`}>
                  {s.ok ? 'PASS' : s.severity.toUpperCase()}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Findings */}
      <Card className="bg-[#111827] border-gray-800" data-testid="findings-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-gray-400">Key Findings</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {analysis.findings.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

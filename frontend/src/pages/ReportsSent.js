import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import axios from 'axios';
import { FileText, Filter, Download, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const API_BASE = process.env.REACT_APP_BACKEND_URL;

const TYPE_COLORS = {
  DPB_NOTICE: 'bg-red-950/50 text-red-400 border-red-900/50',
  CUSTOMER_BREACH_NOTICE: 'bg-amber-950/50 text-amber-400 border-amber-900/50',
  AUDIT_REPORT: 'bg-blue-950/50 text-blue-400 border-blue-900/50',
  DATA_EXPORT: 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50',
  CORRECTION_CONFIRMATION: 'bg-purple-950/50 text-purple-400 border-purple-900/50',
  DELETION_CERTIFICATE: 'bg-gray-800 text-gray-400 border-gray-700',
  VECTOR_ANALYSIS: 'bg-cyan-950/50 text-cyan-400 border-cyan-900/50',
};
const STATUS_COLORS = {
  GENERATED: 'bg-blue-950/50 text-blue-400 border-blue-900/50',
  SENT: 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50',
  DELIVERED: 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50',
  FAILED: 'bg-red-950/50 text-red-400 border-red-900/50',
  DOWNLOADED: 'bg-amber-950/50 text-amber-400 border-amber-900/50',
};

export default function ReportsSent() {
  const { API, authHeaders } = useApp();
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${API}/reports`, authHeaders());
        setReports(res.data || []);
      } catch {}
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, [API, authHeaders]);

  useEffect(() => {
    let filtered = [...reports];
    if (typeFilter !== 'ALL') filtered = filtered.filter(r => r.report_type === typeFilter);
    if (statusFilter !== 'ALL') filtered = filtered.filter(r => r.delivery_status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        (r.report_id || '').toLowerCase().includes(q) ||
        (r.incident_id || '').toLowerCase().includes(q) ||
        (r.customer_id || '').toLowerCase().includes(q) ||
        (r.request_id || '').toLowerCase().includes(q) ||
        (r.recipient || '').toLowerCase().includes(q)
      );
    }
    setFilteredReports(filtered);
  }, [reports, typeFilter, statusFilter, searchQuery]);

  const downloadPdf = (filename) => {
    if (!filename) return;
    window.open(`${API_BASE}/api/pdf/${filename}`, '_blank');
    toast.success('PDF download initiated');
  };

  const downloadCsv = () => {
    window.open(`${API_BASE}/api/csv/reports_sent.csv`, '_blank');
    toast.success('CSV download initiated');
  };

  return (
    <div className="space-y-6" data-testid="reports-sent-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-400" /> Reports Sent
          </h1>
          <p className="text-sm text-gray-500 mt-1">Complete log of all generated, sent, and downloaded reports</p>
        </div>
        <Button variant="outline" className="border-gray-700 text-gray-400" onClick={downloadCsv} data-testid="download-reports-csv-btn">
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap" data-testid="report-filters">
        <Input
          placeholder="Search by ID, incident, customer..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="bg-[#1F2937] border-gray-700 text-white w-64 h-9"
          data-testid="report-search-input"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48 bg-[#1F2937] border-gray-700 text-white h-9">
            <SelectValue placeholder="Report Type" />
          </SelectTrigger>
          <SelectContent className="bg-[#1F2937] border-gray-700">
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="DPB_NOTICE">DPB Notice</SelectItem>
            <SelectItem value="CUSTOMER_BREACH_NOTICE">Customer Notice</SelectItem>
            <SelectItem value="AUDIT_REPORT">Audit Report</SelectItem>
            <SelectItem value="DATA_EXPORT">Data Export</SelectItem>
            <SelectItem value="CORRECTION_CONFIRMATION">Correction</SelectItem>
            <SelectItem value="DELETION_CERTIFICATE">Deletion Cert</SelectItem>
            <SelectItem value="VECTOR_ANALYSIS">Vector Analysis</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-[#1F2937] border-gray-700 text-white h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-[#1F2937] border-gray-700">
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="GENERATED">Generated</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="DOWNLOADED">Downloaded</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-500">{filteredReports.length} of {reports.length} reports</span>
      </div>

      {/* Table */}
      <Card className="bg-[#111827] border-gray-800" data-testid="reports-table">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Report ID</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Generated</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Incident</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Recipient</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-600">No reports found</td></tr>
                )}
                {filteredReports.map((r, i) => (
                  <tr key={i} className="border-b border-gray-800/30 hover:bg-gray-800/30">
                    <td className="py-3 px-4 font-mono text-xs text-blue-400">{r.report_id}</td>
                    <td className="py-3 px-4 text-xs text-gray-400 font-mono">{r.generated_at ? new Date(r.generated_at).toLocaleDateString() : '-'}</td>
                    <td className="py-3 px-4"><Badge className={`text-[10px] ${TYPE_COLORS[r.report_type] || ''}`}>{r.report_type}</Badge></td>
                    <td className="py-3 px-4 font-mono text-xs">{r.incident_id || '-'}</td>
                    <td className="py-3 px-4 font-mono text-xs">{r.customer_id || '-'}</td>
                    <td className="py-3 px-4 text-xs truncate max-w-[120px]">{r.recipient || '-'}</td>
                    <td className="py-3 px-4"><Badge className={`text-[10px] ${STATUS_COLORS[r.delivery_status] || ''}`}>{r.delivery_status}</Badge></td>
                    <td className="py-3 px-4">
                      {r.pdf_filename && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-400" onClick={() => downloadPdf(r.pdf_filename)} data-testid={`download-report-${r.report_id}`}>
                          <Eye className="w-3 h-3 mr-1" /> View
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

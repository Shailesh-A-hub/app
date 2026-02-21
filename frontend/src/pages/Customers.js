import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, Plus, Pencil, Trash2, Download, Upload, Search, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const API_BASE = process.env.REACT_APP_BACKEND_URL;

export default function Customers() {
  const { API, authHeaders } = useApp();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [editDialog, setEditDialog] = useState(null);
  const [addDialog, setAddDialog] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/customers`, authHeaders());
      setCustomers(res.data || []);
    } catch {}
  }, [API, authHeaders]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.customer_id || '').toLowerCase().includes(q) ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q);
  });

  const addCustomer = async () => {
    if (!form.name || !form.email || !form.phone) return toast.error('All fields required');
    setSaving(true);
    try {
      await axios.post(`${API}/customers`, form, authHeaders());
      toast.success('Customer added');
      setAddDialog(false);
      setForm({ name: '', email: '', phone: '' });
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setSaving(false); }
  };

  const updateCustomer = async () => {
    if (!editDialog) return;
    setSaving(true);
    try {
      const updates = {};
      if (form.name) updates.name = form.name;
      if (form.email) updates.email = form.email;
      if (form.phone) updates.phone = form.phone;
      await axios.put(`${API}/customers/${editDialog.customer_id}`, updates, authHeaders());
      toast.success('Customer updated');
      setEditDialog(null);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setSaving(false); }
  };

  const deleteCustomer = async (cid) => {
    if (!window.confirm(`Delete customer ${cid}? This will redact their data.`)) return;
    try {
      await axios.delete(`${API}/customers/${cid}`, authHeaders());
      toast.success(`Customer ${cid} deleted`);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  return (
    <div className="space-y-6" data-testid="customers-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" /> Customer Data
          </h1>
          <p className="text-sm text-gray-500 mt-1">{customers.length} total customers &middot; {customers.filter(c => c.status === 'ACTIVE').length} active</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-gray-700 text-gray-400 h-9" onClick={() => { window.open(`${API_BASE}/api/csv/customers.csv`, '_blank'); toast.success('CSV exported'); }} data-testid="export-csv-btn">
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 h-9" onClick={() => { setForm({ name: '', email: '', phone: '' }); setAddDialog(true); }} data-testid="add-customer-btn">
            <Plus className="w-4 h-4 mr-1.5" /> Add Customer
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="bg-[#1F2937] border-gray-700 text-white pl-9 h-9" data-testid="customer-search-input" />
      </div>

      {/* Table */}
      <Card className="bg-[#111827] border-gray-800" data-testid="customers-table">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Customer ID</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={i} className="border-b border-gray-800/30 hover:bg-gray-800/30">
                    <td className="py-3 px-4 font-mono text-xs text-blue-400">{c.customer_id}</td>
                    <td className="py-3 px-4 text-sm">{c.name}</td>
                    <td className="py-3 px-4 text-xs text-gray-400">{c.email}</td>
                    <td className="py-3 px-4 text-xs font-mono">{c.phone}</td>
                    <td className="py-3 px-4">
                      <Badge className={c.status === 'ACTIVE' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' : 'bg-red-950/50 text-red-400 border-red-900/50'}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {c.status === 'ACTIVE' && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-400" onClick={() => { setForm({ name: c.name, email: c.email, phone: c.phone }); setEditDialog(c); }} data-testid={`edit-${c.customer_id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-400" onClick={() => deleteCustomer(c.customer_id)} data-testid={`delete-${c.customer_id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="bg-[#111827] border-gray-800 text-gray-100">
          <DialogHeader><DialogTitle>Add Customer</DialogTitle><DialogDescription className="text-gray-500">Add a new customer to the database</DialogDescription></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><label className="text-xs text-gray-500 uppercase tracking-wider">Name</label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-[#1F2937] border-gray-700 text-white mt-1" data-testid="add-name-input" /></div>
            <div><label className="text-xs text-gray-500 uppercase tracking-wider">Email</label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="bg-[#1F2937] border-gray-700 text-white mt-1" data-testid="add-email-input" /></div>
            <div><label className="text-xs text-gray-500 uppercase tracking-wider">Phone</label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="bg-[#1F2937] border-gray-700 text-white mt-1" data-testid="add-phone-input" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-700 text-gray-400" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={addCustomer} disabled={saving} data-testid="save-customer-btn">{saving ? 'Saving...' : 'Add Customer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="bg-[#111827] border-gray-800 text-gray-100">
          <DialogHeader><DialogTitle>Edit Customer {editDialog?.customer_id}</DialogTitle><DialogDescription className="text-gray-500">Update customer information</DialogDescription></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><label className="text-xs text-gray-500 uppercase tracking-wider">Name</label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-[#1F2937] border-gray-700 text-white mt-1" data-testid="edit-name-input" /></div>
            <div><label className="text-xs text-gray-500 uppercase tracking-wider">Email</label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="bg-[#1F2937] border-gray-700 text-white mt-1" data-testid="edit-email-input" /></div>
            <div><label className="text-xs text-gray-500 uppercase tracking-wider">Phone</label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="bg-[#1F2937] border-gray-700 text-white mt-1" data-testid="edit-phone-input" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-700 text-gray-400" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={updateCustomer} disabled={saving} data-testid="update-customer-btn">{saving ? 'Saving...' : 'Update Customer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Shield, Lock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Login successful');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-4" data-testid="login-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-xl bg-blue-900/20 border border-blue-800/30 mb-4">
            <Shield className="w-10 h-10 text-blue-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-gray-100 mb-1" style={{ fontFamily: 'Chivo' }}>DPDP SHIELD</h1>
          <p className="text-xs uppercase tracking-[0.25em] text-gray-500 font-medium">Prevent &middot; Detect &middot; Respond</p>
        </div>
        <div className="bg-[#111827] border border-gray-800 rounded-lg p-8" data-testid="login-form">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Admin Authentication</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1.5 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="bg-[#1F2937] border-gray-700 text-white placeholder:text-gray-600 h-11"
                data-testid="login-email-input"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1.5 block">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="bg-[#1F2937] border-gray-700 text-white placeholder:text-gray-600 h-11"
                data-testid="login-password-input"
                required
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-900/30 rounded px-3 py-2" data-testid="login-error">
                <AlertTriangle className="w-4 h-4" /> {error}
              </div>
            )}
            <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold" disabled={loading} data-testid="login-submit-btn">
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </Button>
          </form>
          <p className="text-xs text-gray-600 text-center mt-4">Authorized personnel only. All access is logged.</p>
        </div>
      </div>
    </div>
  );
}

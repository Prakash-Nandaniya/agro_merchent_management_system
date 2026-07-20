import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { settings } from '@/settings';
import { useAuth } from '@/components/authcontext';
import './login.css';

export default function Login() {
  const [fullName, setFullName] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${settings.BE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          current_session_user_name: fullName,
          user_name: userName,
          password,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ? String(body.detail) : 'Login failed.');
      }
      await refreshAuth();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">Sign in</h1>
        <p className="login-subtitle">Enter your credentials to continue</p>

        {error && <div className="login-error">{error}</div>}

        <label className="login-label" htmlFor="full_name">Your Name</label>
        <input
          id="full_name"
          className="login-input"
          type="text"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          autoComplete="name"
          required
        />

        <label className="login-label" htmlFor="user_name">Username</label>
        <input
          id="user_name"
          className="login-input"
          type="text"
          value={userName}
          onChange={e => setUserName(e.target.value)}
          autoComplete="username"
          required
        />

        <label className="login-label" htmlFor="password">Password</label>
        <div className="login-password-wrap">
          <input
            id="password"
            className="login-input login-password-input"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="login-password-toggle"
            onClick={() => setShowPassword(prev => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button className="login-button" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
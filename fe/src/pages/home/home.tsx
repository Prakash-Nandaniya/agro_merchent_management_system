import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from "react";
import { settings } from "@/settings";
import { useAuth } from '@/components/authcontext';
import './home.css';

export default function Home() {
    const { isChecking, isAuthorized, refreshAuth } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleRecruiterLogin() {
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`${settings.BE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    current_session_user_name: 'abcd',
                    user_name: 'abcd',
                    password: 'abcd',
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

    useEffect(() => {
        if (!isChecking && isAuthorized) {
            navigate('/dashboard');
        }
    }, [isChecking, isAuthorized, navigate]);

    const handleLoginClick = () => {
        navigate('/login');
    };

    if (isChecking || isAuthorized) {
        return (
            <div className="home-loading-screen">
                <div className="home-loading-glow">
                    <img src="/apple-touch-icon.png" alt="Karma Trading" className="home-loading-logo" />
                </div>
                <div className="home-loading-text">Loading...</div>
            </div>
        );
    }

    return (
        <div className="landing-container">

            {error && (
                <div className="landing-error-banner">
                    {error}
                </div>
            )}

            {/* --- Dull background watermark logo (desktop/laptop only) --- */}
            <img
                src="/apple-touch-icon.png"
                alt=""
                aria-hidden="true"
                className="landing-bg-logo"
            />

            {/* --- NAVIGATION BAR --- */}
            <nav className="navbar">
                <div className="logo-container">
                    <img src="/apple-touch-icon.png" alt="Karma Trading" className="logo" />
                    <h1 className="brand-name">Karma Trading</h1>
                </div>
                <div className="navbar-actions">
                    <button className="login-btn" onClick={handleLoginClick}>
                        Login
                    </button>
                    <button className="recruiter-btn" type="button" onClick={handleRecruiterLogin} disabled={loading}>
                        {loading ? 'Signing in...' : 'Recruiter'}
                    </button>
                </div>
            </nav>

            {/* --- HERO SECTION --- */}
            <header className="hero-section">
                <img
                    src="/apple-touch-icon.png"
                    alt="Karma Trading"
                    className="hero-mobile-logo"
                />
                <h2 className="hero-title">Smart Billing for Local Agro-Merchants</h2>
                <p className="hero-subtitle">
                    Digitize your daily ledger, generate instant PDF invoices, and manage your commercial trading operations from a single, high-performance dashboard.
                </p>
                <button className="cta-btn" onClick={handleLoginClick}>
                    Access Billbook
                </button>
            </header>

            {/* --- FEATURES GRID --- */}
            <section className="features-section">
                <div className="feature-card">
                    <div className="feature-icon">📄</div>
                    <h3>Instant Invoices</h3>
                    <p>Generate professional commercial bills in seconds. Instantly download, print, or share them directly as a PDF.</p>
                </div>

                <div className="feature-card">
                    <div className="feature-icon">📘</div>
                    <h3>Digital Billbook</h3>
                    <p>Completely replace physical paper ledgers. Automatically save, organize, and back up all your transactions securely.</p>
                </div>

                <div className="feature-card">
                    <div className="feature-icon">🔍</div>
                    <h3>Smart Search</h3>
                    <p>Instantly locate past transactions with advanced filtering by date, client name, or exact invoice amounts.</p>
                </div>
            </section>
        </div>
    );
}
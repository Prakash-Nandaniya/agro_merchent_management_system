import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useContext } from "react";
import { useAuth } from '@/components/authcontext';
import './home.css';
import { settings } from '@/settings';
import OpaqueLoading from '@/components/opaqueloading/loading';
import { ErrorContext } from '@/components/errors/errorcontext';
import ErrorDisplay from '@/components/errors/errordisplay';

/* ---------- Inline SVG icons (stroke-based, inherit currentColor) ---------- */
const iconProps = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
};

const InvoiceIcon = () => (
    <svg {...iconProps}>
        <path d="M6 3h9l4 4v14l-2-1.2L15 21l-3-1.2L9 21l-2-1.2L5 21V4a1 1 0 0 1 1-1z" />
        <path d="M15 3v4h4" />
        <path d="M9 11h6M9 15h4" />
    </svg>
);

const FarmerBillIcon = () => (
    <svg {...iconProps}>
        <path d="M12 21V9" />
        <path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5z" />
        <path d="M12 13c0-2.5-1.8-4.3-4.5-4.3 0 2.7 1.8 4.3 4.5 4.3z" />
        <path d="M12 17c0-2.2-1.6-3.8-4-3.8 0 2.4 1.6 3.8 4 3.8z" />
        <path d="M5 21h14" />
    </svg>
);

const TradeIcon = () => (
    <svg {...iconProps}>
        <path d="M4 8h13l-3-3" />
        <path d="M20 16H7l3 3" />
    </svg>
);

const ChartIcon = () => (
    <svg {...iconProps}>
        <path d="M4 20V4" />
        <path d="M4 20h16" />
        <path d="M8 16v-4M12 16V8M16 16v-6" />
    </svg>
);

const SettingsIcon = () => (
    <svg {...iconProps}>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
    </svg>
);

const AssistantIcon = () => (
    <svg {...iconProps}>
        <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
        <path d="M9 10h.01M12 10h.01M15 10h.01" />
    </svg>
);

const CheckIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
);

const ZoomIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5" />
    </svg>
);

const CloseIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
    </svg>
);

/* Placeholder drawn in SVG, shown until /dummy-bill.png is added to /public */
const BillPlaceholder = () => (
    <svg className="bill-placeholder" viewBox="0 0 320 420" role="img" aria-label="Sample bill preview">
        <rect width="320" height="420" fill="#ffffff" />
        <rect x="24" y="24" width="120" height="14" rx="3" fill="#166534" />
        <rect x="24" y="46" width="170" height="8" rx="3" fill="#cbd5e1" />
        <rect x="236" y="24" width="60" height="8" rx="3" fill="#cbd5e1" />
        <rect x="236" y="40" width="60" height="8" rx="3" fill="#cbd5e1" />
        <line x1="24" y1="76" x2="296" y2="76" stroke="#e2e8f0" />
        <rect x="24" y="92" width="90" height="8" rx="3" fill="#94a3b8" />
        <rect x="24" y="108" width="140" height="8" rx="3" fill="#cbd5e1" />
        <rect x="24" y="124" width="110" height="8" rx="3" fill="#cbd5e1" />
        <rect x="24" y="156" width="272" height="22" fill="#f0fdf4" />
        <rect x="32" y="163" width="60" height="8" rx="3" fill="#166534" opacity="0.7" />
        <rect x="200" y="163" width="40" height="8" rx="3" fill="#166534" opacity="0.7" />
        <rect x="256" y="163" width="32" height="8" rx="3" fill="#166534" opacity="0.7" />
        {[0, 1, 2, 3].map((i) => (
            <g key={i}>
                <rect x="32" y={196 + i * 28} width={90 + (i % 2) * 30} height="8" rx="3" fill="#cbd5e1" />
                <rect x="200" y={196 + i * 28} width="40" height="8" rx="3" fill="#e2e8f0" />
                <rect x="256" y={196 + i * 28} width="32" height="8" rx="3" fill="#e2e8f0" />
                <line x1="24" y1={212 + i * 28} x2="296" y2={212 + i * 28} stroke="#f1f5f9" />
            </g>
        ))}
        <rect x="190" y="330" width="106" height="8" rx="3" fill="#cbd5e1" />
        <rect x="190" y="348" width="106" height="12" rx="3" fill="#166534" />
        <rect x="24" y="380" width="100" height="8" rx="3" fill="#e2e8f0" />
    </svg>
);

const features = [
    {
        icon: <InvoiceIcon />,
        title: 'Invoice Book',
        text: 'Create sales invoices and keep every one on record. Open any past invoice to download, share or print it.',
    },
    {
        icon: <FarmerBillIcon />,
        title: 'Farmer Purchase Bills',
        text: 'Make simple farmer purchase bills and RCM-based self-invoices. All are saved in your Farmer Bill Book.',
    },
    {
        icon: <TradeIcon />,
        title: 'Trade Records',
        text: 'Track each trade from start to finish: mill payment, GST collected, farmer payment, transport, labour, other costs, TDS and RCM payable.',
    },
    {
        icon: <ChartIcon />,
        title: 'Business Dashboard',
        text: 'See total inflow, outflow and net profit or loss for the financial year, with monthly cash flow, crop-wise and party-wise analysis.',
    },
    {
        icon: <SettingsIcon />,
        title: 'Saved Settings',
        text: 'Keep your firm details, crops, HSN codes and GST rates in one place. They fill in automatically on every bill, and you can edit them any time.',
    },
    {
        icon: <AssistantIcon />,
        title: 'Business Assistant',
        text: 'Ask questions about your business and performance in plain language and get an analysis from your own records.',
    },
];

const highlights = [
    'Invoice numbers continue automatically from the last one',
    'Every bill is saved securely on the server',
    'Download, share or print any bill',
];

export default function Home() {
    const { isChecking, isAuthorized, refreshAuth } = useAuth();
    const errorcontext = useContext(ErrorContext);
    const [loading, setLoading] = useState(false);
    const [billImgFailed, setBillImgFailed] = useState(false);
    const [billOpen, setBillOpen] = useState(false);
    const navigate = useNavigate();

    async function handleRecruiterLogin() {
        setLoading(true);

        try {
            const res = await fetch(`${settings.BE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    current_session_user_name: 'recruiter',
                    user_name: settings.USERNAME,
                    password: settings.PASSWORD,
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.detail ? String(body.detail) : 'Recruiter login failed.');
            }
            await refreshAuth();
            navigate('/dashboard');
        } catch (err) {
            errorcontext.addError(err instanceof Error ? err.message : 'Could not reach the server.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!isChecking && isAuthorized) {
            navigate('/dashboard');
        }
    }, [isChecking, isAuthorized, navigate]);

    /* Bill popup: close with Escape, and lock page scroll while open */
    useEffect(() => {
        if (!billOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setBillOpen(false);
        };
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [billOpen]);

    const handleLoginClick = () => {
        navigate('/login');
    };

    if (isChecking || isAuthorized) {
        return <OpaqueLoading />;
    }

    return (
        <div className="landing-container">
            <img
                src="/apple-touch-icon.png"
                alt=""
                aria-hidden="true"
                className="landing-bg-logo"
            />

            <ErrorDisplay />

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
                    <button
                        className="recruiter-btn"
                        onClick={handleRecruiterLogin}
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Recruiter'}
                    </button>
                </div>
            </nav>

            {loading && <OpaqueLoading />}

            {/* --- HERO SECTION --- */}
            <header className="hero-section">
                <div className="hero-text">
                    <img
                        src="/apple-touch-icon.png"
                        alt="Karma Trading"
                        className="hero-mobile-logo"
                    />
                    <h2 className="hero-title">Billing and trade records for crop traders</h2>
                    <p className="hero-subtitle">
                        Make invoices and farmer purchase bills, record every trade, and see
                        your whole business on one dashboard.
                    </p>
                    <ul className="hero-highlights">
                        {highlights.map((h) => (
                            <li key={h}>
                                <CheckIcon />
                                <span>{h}</span>
                            </li>
                        ))}
                    </ul>
                    <button className="cta-btn" onClick={handleLoginClick}>
                        Login to your account
                    </button>
                </div>

                {/* Bill preview: put your dummy bill image at /public/dummy-bill.png
                    Tip: use a sharp, high-res image (about 1200px wide or more). */}
                <figure className="bill-preview">
                    <button
                        type="button"
                        className="bill-paper"
                        onClick={() => setBillOpen(true)}
                        aria-label="Click to enlarge sample bill"
                    >
                        {billImgFailed ? (
                            <BillPlaceholder />
                        ) : (
                            <img
                                src="/dummy-bill.png"
                                alt="Sample invoice generated by Karma Trading"
                                className="bill-image"
                                decoding="async"
                                onError={() => setBillImgFailed(true)}
                            />
                        )}
                    </button>
                    <figcaption>Sample invoice, ready to download, share or print</figcaption>
                </figure>
            </header>

            {/* --- BILL POPUP (click anywhere to close) --- */}
            {billOpen && (
                <div
                    className="bill-lightbox"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Sample bill enlarged"
                    onClick={() => setBillOpen(false)}
                >
                    <button
                        type="button"
                        className="bill-lightbox-close"
                        aria-label="Close"
                        onClick={() => setBillOpen(false)}
                    >
                        <CloseIcon />
                    </button>
                    <div className="bill-lightbox-paper">
                        {billImgFailed ? (
                            <BillPlaceholder />
                        ) : (
                            <img
                                src="/dummy-bill.png"
                                alt="Sample invoice generated by Karma Trading"
                                className="bill-lightbox-image"
                            />
                        )}
                    </div>
                </div>
            )}

            {/* --- FEATURES --- */}
            <section className="features-section">
                <h2 className="features-heading">Everything your trading business needs</h2>
                <div className="features-grid">
                    {features.map((f) => (
                        <div className="feature-card" key={f.title}>
                            <div className="feature-icon">{f.icon}</div>
                            <h3>{f.title}</h3>
                            <p>{f.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="landing-footer">
                <p>Access is by username and password issued by your administrator.</p>
            </footer>
        </div>
    );
}
import './loading.css'

export default function OpaqueLoading() {
    return (
        <div className="opaque-loading-screen">
            <div className="opaque-loading-glow">
                <img src="/apple-touch-icon.png" alt="Karma Trading" className="opaque-loading-logo" />
            </div>
            <div className="opaque-loading-text">Loading...</div>
        </div>
    );
}
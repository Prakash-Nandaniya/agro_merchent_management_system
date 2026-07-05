// features/settings/ProfileConfig.tsx
import { useState, useEffect } from 'react'
import './profileconfig.css'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Crop { hsn: string; sgst: number; cgst: number }
interface Bank { bank: string; account: string; ifsc: string }
interface CropForm { name: string; hsn: string; cgst: string | number; sgst: string | number }
interface ProfileConfig {
    seller: { name: string; address: string; pan: string; gstin: string }
    bank_accounts: Bank[]
    crops: Record<string, Crop>
    terms_and_conditions: string
}

// ─── Empty defaults ─────────────────────────────────────────────────────────────
const EMPTY_CONFIG: ProfileConfig = {
    seller: { name: '', address: '', pan: '', gstin: '' },
    bank_accounts: [],
    crops: {},
    terms_and_conditions: ''
}
const EMPTY_BANK: Bank = { bank: '', account: '', ifsc: '' }
const EMPTY_CROP: CropForm = { name: '', hsn: '', cgst: '', sgst: '' }

// ─── Component ─────────────────────────────────────────────────────────────────
export default function ProfileConfig() {
    const [config, setConfig] = useState<ProfileConfig>(EMPTY_CONFIG)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // bank add / edit
    const [addingBank, setAddingBank] = useState(false)
    const [newBank, setNewBank] = useState<Bank>(EMPTY_BANK)
    const [editingBankIndex, setEditingBankIndex] = useState<number | null>(null)
    const [editBank, setEditBank] = useState<Bank>(EMPTY_BANK)

    // crop add / edit
    const [addingCrop, setAddingCrop] = useState(false)
    const [newCrop, setNewCrop] = useState<CropForm>(EMPTY_CROP)
    const [editingCropKey, setEditingCropKey] = useState<string | null>(null)
    const [editCrop, setEditCrop] = useState<CropForm>(EMPTY_CROP)

    // ── Load config on mount ──────────────────────────────────────────────────────
    useEffect(() => {
        fetch('/api/profile/config')
            .then(r => r.json())
            .then(data => { if (data && Object.keys(data).length > 0) setConfig(data) })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    // auto-dismiss save message after 4 seconds
    useEffect(() => {
        if (!saveMsg) return
        const t = setTimeout(() => setSaveMsg(null), 2000)
        return () => clearTimeout(t)
    }, [saveMsg])

    // ── Seller ────────────────────────────────────────────────────────────────────
    const setSeller = (field: keyof ProfileConfig['seller'], value: string) =>
        setConfig(p => ({ ...p, seller: { ...p.seller, [field]: value } }))

    // ── Banks ─────────────────────────────────────────────────────────────────────
    const deleteBank = (index: number) =>
        setConfig(p => ({ ...p, bank_accounts: p.bank_accounts.filter((_, i) => i !== index) }))

    const startEditBank = (index: number) => {
        setEditingBankIndex(index)
        setEditBank({ ...config.bank_accounts[index] })
    }

    const saveEditBank = () => {
        if (editingBankIndex === null) return
        setConfig(p => ({
            ...p,
            bank_accounts: p.bank_accounts.map((b, i) => i === editingBankIndex ? editBank : b)
        }))
        setEditingBankIndex(null)
    }

    const commitAddBank = () => {
        if (!newBank.bank.trim()) return
        setConfig(p => ({
            ...p,
            bank_accounts: [...p.bank_accounts, newBank]
        }))
        setNewBank(EMPTY_BANK)
        setAddingBank(false)
    }

    // ── Crops ─────────────────────────────────────────────────────────────────────
    const deleteCrop = (key: string) =>
        setConfig(p => { const { [key]: _, ...rest } = p.crops; return { ...p, crops: rest } })

    const startEditCrop = (key: string) => {
        setEditingCropKey(key)
        setEditCrop({ name: key, ...config.crops[key] })
    }

    const saveEditCrop = () => {
        if (!editingCropKey) return
        setConfig(p => {
            const { [editingCropKey]: _, ...rest } = p.crops
            return {
                ...p,
                crops: {
                    ...rest,
                    [editCrop.name || editingCropKey]: {
                        hsn: editCrop.hsn,
                        cgst: parseFloat(editCrop.cgst as string) || 0,
                        sgst: parseFloat(editCrop.sgst as string) || 0
                    }
                }
            }
        })
        setEditingCropKey(null)
    }


    const commitAddCrop = () => {
        if (!newCrop.name.trim()) return
        setConfig(p => ({
            ...p,
            crops: {
                ...p.crops,
                [newCrop.name]: {
                    hsn: newCrop.hsn,
                    cgst: parseFloat(newCrop.cgst as string) || 0,
                    sgst: parseFloat(newCrop.sgst as string) || 0
                }
            }
        }))
        setNewCrop(EMPTY_CROP)
        setAddingCrop(false)
    }


    // ── Save all ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true)
        setSaveMsg(null)
        try {
            const res = await fetch('/api/profile/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            })
            if (!res.ok) throw new Error('Server error')
            setSaveMsg({ type: 'success', text: 'Settings saved successfully ✓' })
        } catch {
            setSaveMsg({ type: 'error', text: 'Failed to save. Please try again.' })
        } finally {
            setSaving(false)
        }
    }

    // ── Loading screen ────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="pc-loading">
            <div className="pc-spinner pc-spinner--dark" />
            <span>Loading settings...</span>
        </div>
    )

    // ── Render ────────────────────────────────────────────────────────────────────
    return (
        <div className="pc-container">

            <div className="pc-page-header">
                <h1>Business Settings</h1>
                <p>Configure your firm details, bank accounts, and crop details.</p>
            </div>

            {/* ══ SELLER ═════════════════════════════════════════════════════════════ */}
            <section className="pc-card">
                <h2 className="pc-card-title">Seller Details</h2>
                <div className="pc-form-grid">
                    <div className="pc-field">
                        <label>Business / Firm Name</label>
                        <input
                            value={config.seller.name}
                            onChange={e => setSeller('name', e.target.value)}
                            placeholder="Bharat Traders"
                        />
                    </div>
                    <div className="pc-field">
                        <label>PAN Number</label>
                        <input
                            value={config.seller.pan}
                            onChange={e => setSeller('pan', e.target.value.toUpperCase())}
                            placeholder="XXXXX0000X"
                            maxLength={10}
                        />
                    </div>
                    <div className="pc-field pc-field--full">
                        <label>GSTIN Number</label>
                        <input
                            value={config.seller.gstin}
                            onChange={e => setSeller('gstin', e.target.value.toUpperCase())}
                            placeholder="00XXXXX0000X0XX"
                            maxLength={15}
                        />
                    </div>
                    <div className="pc-field pc-field--full">
                        <label>Address</label>
                        <textarea
                            value={config.seller.address}
                            onChange={e => setSeller('address', e.target.value)}
                            placeholder="Full business address..."
                            rows={2}
                        />
                    </div>
                </div>
            </section>

            {/* ══ BANKS ══════════════════════════════════════════════════════════════ */}
            <section className="pc-card">
                <div className="pc-card-header">
                    <h2 className="pc-card-title" style={{ margin: 0 }}>Bank Accounts</h2>
                    {!addingBank && (
                        <button className="pc-btn pc-btn--add" onClick={() => setAddingBank(true)}>
                            + Add Account
                        </button>
                    )}
                </div>

                {config.bank_accounts.length === 0 && !addingBank && (
                    <p className="pc-empty">No bank accounts added yet.</p>
                )}

                <div className="pc-list">

                    {config.bank_accounts.map((data, index) =>
                        editingBankIndex === index

                            /* EDIT mode */
                            ? <div key={index} className="pc-list-item pc-list-item--editing">
                                <div className="pc-edit-grid">
                                    <div className="pc-field">
                                        <label>Bank Name</label>
                                        <input value={editBank.bank} onChange={e => setEditBank(p => ({ ...p, bank: e.target.value }))} placeholder="ICICI Bank" />
                                    </div>
                                    <div className="pc-field">
                                        <label>Account Number</label>
                                        <input value={editBank.account} onChange={e => setEditBank(p => ({ ...p, account: e.target.value }))} placeholder="000000000000" />
                                    </div>
                                    <div className="pc-field">
                                        <label>IFSC Code</label>
                                        <input value={editBank.ifsc} onChange={e => setEditBank(p => ({ ...p, ifsc: e.target.value.toUpperCase() }))} placeholder="XXXX0000000" maxLength={11} />
                                    </div>
                                </div>
                                <div className="pc-item-actions">
                                    <button className="pc-btn pc-btn--confirm" onClick={saveEditBank}>Save</button>
                                    <button className="pc-btn pc-btn--cancel" onClick={() => setEditingBankIndex(null)}>Cancel</button>
                                </div>
                            </div>

                            /* VIEW mode */
                            : <div key={index} className="pc-list-item">
                                <div className="pc-item-info">
                                    <span className="pc-item-chip">{data.bank}</span>
                                    <span className="pc-item-detail">A/C: {data.account}</span>
                                    <span className="pc-item-detail">IFSC: {data.ifsc}</span>
                                </div>
                                <div className="pc-item-actions">
                                    <button className="pc-btn pc-btn--edit" onClick={() => startEditBank(index)}>Edit</button>
                                    <button className="pc-btn pc-btn--delete" onClick={() => deleteBank(index)}>Delete</button>
                                </div>
                            </div>
                    )}

                    {/* ADD form */}
                    {addingBank && (
                        <div className="pc-list-item pc-list-item--adding">
                            <div className="pc-edit-grid">
                                <div className="pc-field">
                                    <label>Bank Name</label>
                                    <input value={newBank.bank} onChange={e => setNewBank(p => ({ ...p, bank: e.target.value }))} placeholder="ICICI Bank" />
                                </div>
                                <div className="pc-field">
                                    <label>Account Number</label>
                                    <input value={newBank.account} onChange={e => setNewBank(p => ({ ...p, account: e.target.value }))} placeholder="000000000000" />
                                </div>
                                <div className="pc-field">
                                    <label>IFSC Code</label>
                                    <input value={newBank.ifsc} onChange={e => setNewBank(p => ({ ...p, ifsc: e.target.value.toUpperCase() }))} placeholder="XXXX0000000" maxLength={11} />
                                </div>
                            </div>
                            <div className="pc-item-actions">
                                <button className="pc-btn pc-btn--confirm" onClick={commitAddBank}>Add</button>
                                <button className="pc-btn pc-btn--cancel" onClick={() => { setAddingBank(false); setNewBank(EMPTY_BANK) }}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* ══ CROPS ══════════════════════════════════════════════════════════════ */}
            <section className="pc-card">
                <div className="pc-card-header">
                    <h2 className="pc-card-title" style={{ margin: 0 }}>Crop Catalog</h2>
                    {!addingCrop && (
                        <button className="pc-btn pc-btn--add" onClick={() => setAddingCrop(true)}>
                            + Add Crop
                        </button>
                    )}
                </div>

                {Object.keys(config.crops).length === 0 && !addingCrop && (
                    <p className="pc-empty">No crops configured yet.</p>
                )}

                <div className="pc-list">

                    {Object.entries(config.crops).map(([key, data]) =>
                        editingCropKey === key

                            /* EDIT mode */
                            ? <div key={key} className="pc-list-item pc-list-item--editing">
                                <div className="pc-edit-grid pc-edit-grid--crop">
                                    <div className="pc-field">
                                        <label>Crop Name</label>
                                        <input value={editCrop.name} onChange={e => setEditCrop(p => ({ ...p, name: e.target.value.toUpperCase() }))} />
                                    </div>
                                    <div className="pc-field">
                                        <label>HSN Code</label>
                                        <input maxLength={6} value={editCrop.hsn} onChange={e => setEditCrop(p => ({ ...p, hsn: e.target.value }))} />
                                    </div>
                                    <div className="pc-field">
                                        <label>CGST %</label>
                                        <input type="number" value={editCrop.cgst} inputMode="decimal" placeholder="0.0" onChange={e => setEditCrop(p => ({ ...p, cgst: e.target.value }))} />
                                    </div>
                                    <div className="pc-field">
                                        <label>SGST %</label>
                                        <input type="number" value={editCrop.sgst} inputMode="decimal" placeholder="0.0" onChange={e => setEditCrop(p => ({ ...p, sgst: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="pc-item-actions">
                                    <button className="pc-btn pc-btn--confirm" onClick={saveEditCrop}>Save</button>
                                    <button className="pc-btn pc-btn--cancel" onClick={() => setEditingCropKey(null)}>Cancel</button>
                                </div>
                            </div>

                            /* VIEW mode */
                            : <div key={key} className="pc-list-item">
                                <div className="pc-item-info">
                                    <span className="pc-item-label">{key}</span>
                                    <span className="pc-item-chip">HSN: {data.hsn}</span>
                                    <span className="pc-item-detail">CGST: {data.cgst}%</span>
                                    <span className="pc-item-detail">SGST: {data.sgst}%</span>
                                </div>
                                <div className="pc-item-actions">
                                    <button className="pc-btn pc-btn--edit" onClick={() => startEditCrop(key)}>Edit</button>
                                    <button className="pc-btn pc-btn--delete" onClick={() => deleteCrop(key)}>Delete</button>
                                </div>
                            </div>
                    )}

                    {/* ADD form */}
                    {addingCrop && (
                        <div className="pc-list-item pc-list-item--adding">
                            <div className="pc-edit-grid pc-edit-grid--crop">
                                <div className="pc-field">
                                    <label>Crop Name</label>
                                    <input value={newCrop.name} onChange={e => setNewCrop(p => ({ ...p, name: e.target.value.toUpperCase() }))} placeholder="WHEAT" />
                                </div>
                                <div className="pc-field">
                                    <label>HSN Code</label>
                                    <input maxLength={6} value={newCrop.hsn} onChange={e => setNewCrop(p => ({ ...p, hsn: e.target.value }))} placeholder="100199" />
                                </div>
                                <div className="pc-field">
                                    <label>CGST %</label>
                                    <input type="number" value={newCrop.cgst} inputMode="decimal" placeholder="0.0" onChange={e => setNewCrop(p => ({ ...p, cgst: e.target.value }))} />
                                </div>
                                <div className="pc-field">
                                    <label>SGST %</label>
                                    <input type="number" value={newCrop.sgst} inputMode="decimal" placeholder="0.0" onChange={e => setNewCrop(p => ({ ...p, sgst: e.target.value }))} />
                                </div>
                            </div>
                            <div className="pc-item-actions">
                                <button className="pc-btn pc-btn--confirm" onClick={commitAddCrop}>Add</button>
                                <button className="pc-btn pc-btn--cancel" onClick={() => { setAddingCrop(false); setNewCrop(EMPTY_CROP) }}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* ══ TERMS ══════════════════════════════════════════════════════════════ */}
            <section className="pc-card">
                <h2 className="pc-card-title">Terms &amp; Conditions</h2>
                <textarea
                    className="pc-terms-textarea"
                    value={config.terms_and_conditions}
                    onChange={e => setConfig(p => ({ ...p, terms_and_conditions: e.target.value }))}
                    placeholder="Default terms printed on every invoice..."
                    rows={4}
                />
            </section>

            {/* ══ FOOTER: save message + button ══════════════════════════════════════ */}
            {saveMsg && (
                <div className={`pc-save-msg pc-save-msg--${saveMsg.type}`}>
                    {saveMsg.text}
                </div>
            )}

            <div className="pc-footer">
                <button className="pc-btn pc-btn--save-all" onClick={handleSave} disabled={saving}>
                    {saving
                        ? <><span className="pc-spinner" /> Saving...</>
                        : 'Save Changes'
                    }
                </button>
            </div>

        </div>
    )
}
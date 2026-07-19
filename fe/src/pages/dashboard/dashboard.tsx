import BillButton from "@/components/bill_button/billbutton";
import BillBookButton from "@/components/view_bill_book_button/billbookbutton";
import Navbar from "@/components/navbar/navbar";
import './dashboard.css';
import { useEffect, useState } from "react";
import { apiFetch } from '@/utils/apifetch';
import { settings } from "@/settings"

export default function Dashboard() {
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await apiFetch(`${settings.BE_URL}/health`);
                if (res.ok) {
                    console.log('Health check passed');
                    setIsAuthorized(true);
                }
            } catch (error) {
                console.error('Health check failed:', error);
            } finally {
                setIsChecking(false);
            }
        };

        checkHealth();
    }, []);

    if (isChecking) {
        return (
            <div></div>
        );
    }

    if (!isAuthorized) {
        return (<div></div>);
    }

    return (
        <div className="dashboard min-h-screen bg-gray-300 print:bg-white">
            <Navbar />
            <div className="buttons-container">
                <BillButton />
                <BillBookButton />
            </div>
        </div>
    );
}
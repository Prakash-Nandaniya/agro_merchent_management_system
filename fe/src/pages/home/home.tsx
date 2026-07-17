import BillButton from "@/components/bill_button/billbutton";
import BillBookButton from "@/components/view_bill_book_button/billbookbutton";
import Navbar from "@/components/navbar/navbar";
import './home.css';
import { useEffect } from "react";
import { apiFetch } from '@/utils/apifetch';
import { settings } from "@/settings"
export default function Home() {
    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await apiFetch(`${settings.BE_URL}/health`);
                if (res.ok) {
                    console.log('Health check passed');
                    // const data = await res.json(); // if your endpoint returns JSON
                }
            } catch (error) {
                // apiFetch automatically handles the 401/403 redirects, 
                // so you only need to catch network or other thrown errors here.
                console.error('Health check failed:', error);
            }
        };

        checkHealth();
    }, []);

    return (
        <div className="min-h-screen bg-gray-300 print:bg-white">
            <Navbar />
            <div className="buttons-container">
                <div className="bill-buttons-container">
                    <BillButton buttonname="Farmer Bill" buttonpath="/new-bill/farmer" />
                    <BillButton buttonname="Mill Bill" buttonpath="/new-bill/mill" />
                </div>
                <div className="view-bill-book-button-container">
                    <BillBookButton buttonname="Farmer bill book" buttonpath="/bill-book/farmer" />
                    <BillBookButton buttonname="Mill bill book" buttonpath="/bill-book/mill" />
                </div>
            </div>
        </div>
    )
}
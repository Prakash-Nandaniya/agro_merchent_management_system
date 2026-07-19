import BillButton from "@/components/bill_button/billbutton";
import BillBookButton from "@/components/view_bill_book_button/billbookbutton";
import Navbar from "@/components/navbar/navbar";
import './dashboard.css';

export default function Dashboard() {
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
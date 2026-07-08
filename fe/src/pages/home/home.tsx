import BillButton from "@/components/bill_button/billbutton";
import BillBookButton from "@/components/view_bill_book_button/billbookbutton";
import Navbar from "@/components/navbar/navbar";
import './home.css';

export default function Home() {
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
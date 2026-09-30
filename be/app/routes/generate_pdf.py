from typing import List

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.schemas.invoice import InvoicePdfRequest
from app.services.generate_pdf import pdf_renderer, lifespan
from app.core.exceptions import PdfGenerationFailed

router = APIRouter()


@router.post("/generate-invoice-pdf")
async def generate_pdf(bill: InvoicePdfRequest):
    try:
        pdf_bytes = await pdf_renderer.render_pdf(bill)
    except Exception as exc:
        raise PdfGenerationFailed(detail=f"PDF generation failed: {exc}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="Invoice_{bill.invoice_no}.pdf"'
        },
    )


@router.post("/generate-invoice-book-pdf")
async def generate_pdf_book(bills: List[InvoicePdfRequest]):
    if not bills:
        raise HTTPException(status_code=400, detail="At least one bill is required.")

    try:
        pdf_bytes = await pdf_renderer.render_pdf_book(bills)
    except Exception as exc:
        raise PdfGenerationFailed(detail=f"PDF book generation failed: {exc}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="Invoice_Book.pdf"'},
    )


@router.post("/generate-farmer-purchase-pdf")
async def generate_farmer_purchase_pdf(bill: dict):
    try:
        pdf_bytes = await pdf_renderer.render_farmer_purchase_pdf(bill)
    except Exception as exc:
        raise PdfGenerationFailed(detail=f"Farmer purchase PDF generation failed: {exc}")

    filename = "Farmer_Purchase_" + str(bill.get("voucher_no") or bill.get("invoice_no") or "Bill") + ".pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post("/generate-farmer-purchase-book-pdf")
async def generate_farmer_purchase_book_pdf(bills: List[dict]):
    if not bills:
        raise HTTPException(status_code=400, detail="At least one bill is required.")

    try:
        pdf_bytes = await pdf_renderer.render_farmer_purchase_book_pdf(bills)
    except Exception as exc:
        raise PdfGenerationFailed(detail=f"Farmer purchase book PDF generation failed: {exc}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="Farmer_Purchase_Book.pdf"'},
    )

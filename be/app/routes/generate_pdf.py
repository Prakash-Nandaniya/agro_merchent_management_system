from fastapi import APIRouter
from fastapi.responses import Response
from app.schemas.generatepdf import MillBill
from app.services.generate_pdf import pdf_renderer, lifespan
from app.core.exceptions import PdfGenerationFailed
router = APIRouter()

@router.post("/generate-pdf")
async def generate_pdf(bill: MillBill):
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
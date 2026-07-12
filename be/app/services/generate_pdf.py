import base64
from pathlib import Path
from contextlib import asynccontextmanager

from jinja2 import Environment, FileSystemLoader, select_autoescape
from playwright.async_api import async_playwright, Browser

from app.schemas.generatepdf import MillBill

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
ASSETS_DIR = Path(__file__).parent.parent / "assets"
MIN_ROWS = 6

jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)

# Read the watermark once at import time and inline it as base64 so the
# generated HTML is fully self-contained — no relative asset paths for
# Playwright to resolve.
_watermark_path = ASSETS_DIR / "karma_trading_logo_color_bg_removed.png"
_watermark_data_uri = None
if _watermark_path.exists():
    _b64 = base64.b64encode(_watermark_path.read_bytes()).decode("ascii")
    _watermark_data_uri = f"data:image/png;base64,{_b64}"


def _fmt(val) -> str:
    if not val:
        return ""
    try:
        n = float(val)
    except (TypeError, ValueError):
        return ""
    if n == 0:
        return ""
    return f"{n:,.2f}"


def _format_date(iso: str) -> str:
    if not iso:
        return ""
    parts = iso.split("-")
    if len(parts) != 3:
        return iso
    y, m, d = parts
    return f"{d}/{m}/{y}"


def _build_display_rows(bill: MillBill) -> list:
    rows = [
        {
            "crop": c.crop,
            "hsn_code": c.hsn_code,
            "qty": c.qty,
            "uqc": c.uqc,
            "rate": c.rate,
            "taxable_value": _fmt(c.taxable_value),
            "cgst_rate": c.cgst_rate,
            "cgst_amount": _fmt(c.cgst_amount) or "0.00",
            "sgst_rate": c.sgst_rate,
            "sgst_amount": _fmt(c.sgst_amount) or "0.00",
            "final_amount": _fmt(c.final_amount),
        }
        for c in bill.crops
    ]
    while len(rows) < MIN_ROWS:
        rows.append(None)
    return rows


def render_invoice_html(bill: MillBill) -> str:
    template = jinja_env.get_template("millbill.html")
    return template.render(
        bill=bill,
        rows=_build_display_rows(bill),
        invoice_date=_format_date(bill.invoice_date),
        final_taxable_amount=_fmt(bill.final_taxable_amount),
        final_cgst_amount=_fmt(bill.final_cgst_amount),
        final_sgst_amount=_fmt(bill.final_sgst_amount),
        final_amount=_fmt(bill.final_amount),
        watermark_data_uri=_watermark_data_uri,
    )


# ── Browser lifecycle — launched once, reused across requests ──────────────
class PdfRenderer:
    def __init__(self):
        self._playwright = None
        self.browser: Browser | None = None

    async def start(self):
        self._playwright = await async_playwright().start()
        self.browser = await self._playwright.chromium.launch(headless=True)

    async def stop(self):
        if self.browser:
            await self.browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def render_pdf(self, bill: MillBill) -> bytes:
        if not self.browser:
            raise RuntimeError("PdfRenderer not started.")

        html = render_invoice_html(bill)

        # Viewport now matches the A4 printable width exactly, so nothing
        # needs to be scaled down at print time.
        page = await self.browser.new_page(viewport={"width": 690, "height": 1200})
        try:
            await page.set_content(html, wait_until="networkidle")

            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                scale=1.0,  # no longer needed as a fit hack — content already fits
                margin={
                    "top": "0.5in",
                    "bottom": "0.5in",
                    "left": "0.5in",
                    "right": "0.5in",
                },
            )
            return pdf_bytes
        finally:
            await page.close()


pdf_renderer = PdfRenderer()


@asynccontextmanager
async def lifespan(app):
    await pdf_renderer.start()
    yield
    await pdf_renderer.stop()

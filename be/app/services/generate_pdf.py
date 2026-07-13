import base64
from pathlib import Path
from contextlib import asynccontextmanager
from typing import List

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

_watermark_path = ASSETS_DIR / "karma_trading_logo_color_bg_removed.png"
_watermark_data_uri = None
if _watermark_path.exists():
    _b64 = base64.b64encode(_watermark_path.read_bytes()).decode("ascii")
    _watermark_data_uri = f"data:image/png;base64,{_b64}"


def _indian_grouping(integer_str: str) -> str:
    """Group digits Indian-style: last 3 together, then pairs of 2 going left.
    e.g. '34736211' -> '3,47,36,211'
    """
    if len(integer_str) <= 3:
        return integer_str
    last_three = integer_str[-3:]
    rest = integer_str[:-3]
    groups = []
    while len(rest) > 2:
        groups.insert(0, rest[-2:])
        rest = rest[:-2]
    if rest:
        groups.insert(0, rest)
    return ",".join(groups) + "," + last_three


def _fmt(val) -> str:
    """Format a numeric value in Indian digit grouping with 2 decimals,
    e.g. 34736211 -> '3,47,36,211.00'
    """
    if not val:
        return ""
    try:
        n = float(val)
    except (TypeError, ValueError):
        return ""
    if n == 0:
        return ""
    negative = n < 0
    n = abs(n)
    integer_part, _, decimal_part = f"{n:.2f}".partition(".")
    grouped = _indian_grouping(integer_part)
    result = f"{grouped}.{decimal_part}"
    return f"-{result}" if negative else result


def _format_date(iso: str) -> str:
    if not iso:
        return ""
    parts = iso.split("-")
    if len(parts) != 3:
        return iso
    y, m, d = parts
    return f"{d}/{m}/{y}"


def _split_crop_name(name: str) -> tuple[str, str]:
    if not name:
        return "", ""
    idx = name.find("(")
    if idx == -1:
        return name.strip(), ""
    return name[:idx].strip(), name[idx:].strip()


def _build_display_rows(bill: MillBill) -> list:
    rows = []
    for c in bill.crops:
        crop_line1, crop_line2 = _split_crop_name(c.crop)
        rows.append({
            "crop_line1": crop_line1,
            "crop_line2": crop_line2,
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
        })
    while len(rows) < MIN_ROWS:
        rows.append(None)
    return rows


def _build_bill_context(bill: MillBill) -> dict:
    """Everything a single invoice page needs to render — shared by both
    the single-bill template and each iteration of the book template, so
    the two can never drift out of sync with each other.
    """
    return {
        "bill": bill,
        "rows": _build_display_rows(bill),
        "invoice_date": _format_date(bill.invoice_date),
        "final_taxable_amount": _fmt(bill.final_taxable_amount),
        "final_cgst_amount": _fmt(bill.final_cgst_amount),
        "final_sgst_amount": _fmt(bill.final_sgst_amount),
        "final_amount": _fmt(bill.final_amount),
        "watermark_data_uri": _watermark_data_uri,
    }


def render_invoice_html(bill: MillBill) -> str:
    template = jinja_env.get_template("millbill.html")
    return template.render(**_build_bill_context(bill))


def render_bill_book_html(bills: List[MillBill]) -> str:
    """One combined document, one invoice-page per bill, in the exact
    order given — that order carries straight through to page order.
    """
    template = jinja_env.get_template("millbill_book.html")
    return template.render(bills=[_build_bill_context(b) for b in bills])


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

        page = await self.browser.new_page(viewport={"width": 690, "height": 1200})
        try:
            await page.set_content(html, wait_until="networkidle")

            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                scale=1.0,  
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

    async def render_pdf_book(self, bills: List[MillBill]) -> bytes:
        if not self.browser:
            raise RuntimeError("PdfRenderer not started.")
        if not bills:
            raise ValueError("At least one bill is required to build a book.")

        html = render_bill_book_html(bills)

        page = await self.browser.new_page(viewport={"width": 690, "height": 1200})
        try:
            await page.set_content(html, wait_until="networkidle")

            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
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
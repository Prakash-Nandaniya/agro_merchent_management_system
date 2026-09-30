import asyncio
import base64
from pathlib import Path
from contextlib import asynccontextmanager
from decimal import Decimal, InvalidOperation
from typing import List

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML, CSS

from app.schemas.invoice import Invoice
from app.chatbot.history_store import purge_old_threads

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
ASSETS_DIR = Path(__file__).parent.parent / "assets"
MIN_ROWS = 6

# Farmer purchase templates:
#   both GST rates zero      -> purchase_bill.html
#   any GST rate above zero  -> rc_purchase_bill.html
PURCHASE_TEMPLATE = "purchase_bill.html"
RCM_PURCHASE_TEMPLATE = "rcm_purchase_bill.html"

jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)

_watermark_path = ASSETS_DIR / "karma_trading_logo_color_bg_removed.png"
_watermark_data_uri = None
if _watermark_path.exists():
    _b64 = base64.b64encode(_watermark_path.read_bytes()).decode("ascii")
    _watermark_data_uri = f"data:image/png;base64,{_b64}"

# Playwright used to get A4 + 0.5in margins from page.pdf(format=..., margin=...).
# WeasyPrint reads page setup from CSS @page instead — applied as an extra
# stylesheet at render time so invoice.html / invoice_book.html need zero changes.
_PAGE_CSS = CSS(string="""
    @page {
        size: A4;
        margin: 0.5in;
    }
""")


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
    if val is None or val == "":
        return "0.00"
    try:
        n = Decimal(str(val))
    except (TypeError, ValueError, InvalidOperation):
        return "0.00"

    if n == 0:
        return "0.00"

    negative = n < 0
    n = abs(n).quantize(Decimal("0.01"))
    integer_part, _, decimal_part = format(n, "f").partition(".")
    grouped = _indian_grouping(integer_part)
    result = f"{grouped}.{decimal_part.zfill(2)}"
    return f"-{result}" if negative else result


def _format_date(iso) -> str:
    if not iso:
        return ""

    iso_str = str(iso)

    parts = iso_str.split("-")
    if len(parts) != 3:
        return iso_str
    y, m, d = parts
    return f"{d}/{m}/{y}"


def _split_crop_name(name: str) -> tuple[str, str]:
    if not name:
        return "", ""
    idx = name.find("(")
    if idx == -1:
        return name.strip(), ""
    return name[:idx].strip(), name[idx:].strip()


def _to_decimal(val) -> Decimal:
    """Safely convert '', None, or junk strings to Decimal(0)."""
    if val is None or val == "":
        return Decimal(0)
    try:
        return Decimal(str(val))
    except (InvalidOperation, ValueError):
        return Decimal(0)


def _build_display_rows(bill: Invoice) -> list:
    """One invoice row now holds exactly one crop's worth of data (the
    merged table), so there's a single populated row plus blank padding
    rows to keep the table height consistent with the old multi-crop look.
    """
    crop_line1, crop_line2 = _split_crop_name(bill.crop)
    rows = [
        {
            "crop_line1": crop_line1,
            "crop_line2": crop_line2,
            "hsn_code": bill.hsn_code,
            "qty": _fmt(bill.qty),
            "uqc": bill.uqc,
            "rate": _fmt(bill.rate),
            "taxable_value": _fmt(bill.taxable_amount),
            "cgst_rate": bill.cgst_rate,
            "cgst_amount": _fmt(bill.cgst_amount) or "0.00",
            "sgst_rate": bill.sgst_rate,
            "sgst_amount": _fmt(bill.sgst_amount) or "0.00",
            "final_amount": _fmt(bill.final_amount),
        }
    ]
    while len(rows) < MIN_ROWS:
        rows.append(None)
    return rows


def _terms_lines(raw_terms: object) -> list[str]:
    if raw_terms is None:
        return []
    return [line.strip() for line in str(raw_terms).splitlines() if line.strip()]


def _build_bill_context(bill: Invoice) -> dict:
    """Everything a single invoice page needs to render — shared by both
    the single-bill template and each iteration of the book template, so
    the two can never drift out of sync with each other.
    """
    return {
        "bill": bill,
        "rows": _build_display_rows(bill),
        "invoice_date": _format_date(bill.invoice_date),
        "final_taxable_amount": _fmt(bill.taxable_amount),
        "final_cgst_amount": _fmt(bill.cgst_amount),
        "final_sgst_amount": _fmt(bill.sgst_amount),
        "final_amount": _fmt(bill.final_amount),
        "watermark_data_uri": _watermark_data_uri,
    }


def render_invoice_html(bill: Invoice) -> str:
    template = jinja_env.get_template("invoice.html")
    return template.render(**_build_bill_context(bill))


def _first_present(mapping: dict, *keys):
    for key in keys:
        if mapping.get(key) not in (None, ""):
            return mapping.get(key)
    return ""


def _normalize_farmer_purchase_bill(raw_bill: dict) -> dict:
    payload = raw_bill or {}
    invoice_date = (
        payload.get("voucher_date")
        or payload.get("voucherDate")
        or payload.get("invoice_date")
        or payload.get("invoiceDate")
        or ""
    )
    return {
        "seller_name": _first_present(payload, "merchant_name", "seller_name"),
        "seller_address": _first_present(payload, "merchant_address", "seller_address"),
        "seller_pan": _first_present(payload, "merchantPAN", "merchant_pan", "seller_pan"),
        "seller_gstin": _first_present(payload, "merchantGSTIN", "merchant_gstin", "seller_gstin"),
        "invoice_no": _first_present(payload, "voucher_no", "invoice_no"),
        "invoice_date": _format_date(invoice_date),
        "party_name": _first_present(payload, "farmer_name", "party_name"),
        "party_address": _first_present(payload, "farmer_address", "party_address"),
        "party_city": _first_present(payload, "farmer_village", "party_city"),
        "party_state": _first_present(payload, "farmer_state", "party_state"),
        "party_gstin": _first_present(payload, "party_gstin", ""),
        "party_pan": _first_present(payload, "farmerPAN", "farmer_pan", "party_pan"),
        "crop": _first_present(payload, "crop", ""),
        "hsn_code": _first_present(payload, "hsnCode", "hsn_code"),
        "qty": _first_present(payload, "qty", "0"),
        "uqc": _first_present(payload, "uqc", ""),
        "rate": _first_present(payload, "rate", "0"),
        "taxable_amount": _first_present(payload, "taxable_amount", "taxableAmt", "0"),
        "cgst_rate": _first_present(payload, "cgst_rate", "cgstRate", "0"),
        "cgst_amount": _first_present(payload, "cgst_amount", "cgstAmt", "0"),
        "sgst_rate": _first_present(payload, "sgst_rate", "sgstRate", "0"),
        "sgst_amount": _first_present(payload, "sgst_amount", "sgstAmt", "0"),
        "final_amount": _first_present(payload, "payable_amount", "payableAmt", "final_amount", "finalAmt", "0"),
        "final_amount_in_words": _first_present(payload, "final_amount_in_words", "finalAmountInWords", "amount_in_words", "amountInWords", ""),
        "terms": _first_present(payload, "terms", ""),
        "seller_bank": _first_present(payload, "seller_bank", ""),
        "seller_account": _first_present(payload, "seller_account", ""),
        "seller_ifsc": _first_present(payload, "seller_ifsc", ""),
        "payment_method": _first_present(payload, "payment_method", "paymentMethod") or "Cash",
        "payment_reference": _first_present(payload, "payment_reference", "paymentReference"),
        "document_type": _first_present(payload, "document_type", "documentType") or "Purchase Bill",
    }


def _is_farmer_purchase_rcm(normalized_bill: dict) -> bool:
    """RCM when either GST rate is above zero. Rates are checked (not
    document_type) so the template can never disagree with the tax figures.
    Works on the normalized dict, so both camelCase and snake_case
    payloads are handled."""
    return (
        _to_decimal(normalized_bill.get("cgst_rate")) > 0
        or _to_decimal(normalized_bill.get("sgst_rate")) > 0
    )


def _build_farmer_purchase_context(raw_bill: dict) -> dict:
    normalized = _normalize_farmer_purchase_bill(raw_bill)
    display_bill = {
        **normalized,
        "qty": _fmt(normalized.get("qty") or "0"),
        "rate": _fmt(normalized.get("rate") or "0"),
        "taxable_amount": _fmt(normalized.get("taxable_amount") or "0"),
        "cgst_amount": _fmt(normalized.get("cgst_amount") or "0"),
        "sgst_amount": _fmt(normalized.get("sgst_amount") or "0"),
        "final_amount": _fmt(normalized.get("final_amount") or "0"),
    }
    rcm_total_tax = _to_decimal(normalized.get("cgst_amount") or "0") + _to_decimal(normalized.get("sgst_amount") or "0")
    return {
        "bill": display_bill,
        "rows": _build_farmer_purchase_display_rows(display_bill),
        "invoice_date": _format_date(normalized.get("invoice_date")),
        "final_taxable_amount": _fmt(normalized.get("taxable_amount") or "0"),
        "final_cgst_amount": _fmt(normalized.get("cgst_amount") or "0"),
        "final_sgst_amount": _fmt(normalized.get("sgst_amount") or "0"),
        "final_amount": _fmt(normalized.get("final_amount") or "0"),
        "rcm_total_tax": _fmt(rcm_total_tax),
        "watermark_data_uri": _watermark_data_uri,
        "is_rcm": _is_farmer_purchase_rcm(normalized),
        "terms_lines": _terms_lines(normalized.get("terms") or ""),
    }


def _build_farmer_purchase_display_rows(bill: dict) -> list:
    crop_name = str(bill.get("crop") or "")
    if "(" in crop_name:
        crop_part, crop_sub = crop_name.split("(", 1)
        crop_line1 = crop_part.strip()
        crop_line2 = f"({crop_sub.strip()}"
    else:
        crop_line1 = crop_name.strip()
        crop_line2 = ""

    rows = [{
        "crop_line1": crop_line1,
        "crop_line2": crop_line2,
        "hsn_code": bill.get("hsn_code") or "",
        "qty": _fmt(bill.get("qty") or "0"),
        "uqc": bill.get("uqc") or "",
        "rate": _fmt(bill.get("rate") or "0"),
        "taxable_value": _fmt(bill.get("taxable_amount") or "0"),
        "cgst_rate": bill.get("cgst_rate") or "0",
        "cgst_amount": _fmt(bill.get("cgst_amount") or "0") or "0.00",
        "sgst_rate": bill.get("sgst_rate") or "0",
        "sgst_amount": _fmt(bill.get("sgst_amount") or "0") or "0.00",
        "final_amount": _fmt(bill.get("final_amount") or "0"),
    }]
    while len(rows) < MIN_ROWS:
        rows.append(None)
    return rows


def render_farmer_purchase_html(bill: dict) -> str:
    """Zero GST rates        -> purchase_bill.html
    Any GST rate above zero -> rc_purchase_bill.html
    """
    context = _build_farmer_purchase_context(bill)
    template_name = RCM_PURCHASE_TEMPLATE if context["is_rcm"] else PURCHASE_TEMPLATE
    template = jinja_env.get_template(template_name)
    return template.render(**context)


def render_farmer_purchase_book_html(bills: List[dict]) -> str:
    template = jinja_env.get_template("farmer_purchase_book.html")
    return template.render(bills=[_build_farmer_purchase_context(b) for b in bills])


def render_bill_book_html(bills: List[Invoice]) -> str:
    """One combined document, one invoice-page per bill, in the exact
    order given — that order carries straight through to page order.
    """
    template = jinja_env.get_template("invoice_book.html")
    return template.render(bills=[_build_bill_context(b) for b in bills])


def _render_pdf_sync(html: str) -> bytes:
    """WeasyPrint is synchronous and CPU-bound — always call this through
    asyncio.to_thread so it doesn't block the event loop under concurrent load."""
    return HTML(string=html).write_pdf(stylesheets=[_PAGE_CSS])


# ── Kept as a class with start/stop so main.py's lifespan wiring and the
# router's `pdf_renderer.render_pdf(...)` calls don't need to change.
# WeasyPrint has no browser process to manage, so these are now no-ops.
class PdfRenderer:
    async def start(self):
        pass

    async def stop(self):
        pass

    async def render_pdf(self, bill: Invoice) -> bytes:
        html = render_invoice_html(bill)
        return await asyncio.to_thread(_render_pdf_sync, html)

    async def render_farmer_purchase_pdf(self, bill: dict) -> bytes:
        html = render_farmer_purchase_html(bill)
        return await asyncio.to_thread(_render_pdf_sync, html)

    async def render_farmer_purchase_book_pdf(self, bills: List[dict]) -> bytes:
        if not bills:
            raise ValueError("At least one bill is required to build a book.")
        html = render_farmer_purchase_book_html(bills)
        return await asyncio.to_thread(_render_pdf_sync, html)

    async def render_pdf_book(self, bills: List[Invoice]) -> bytes:
        if not bills:
            raise ValueError("At least one bill is required to build a book.")
        html = render_bill_book_html(bills)
        return await asyncio.to_thread(_render_pdf_sync, html)


pdf_renderer = PdfRenderer()


@asynccontextmanager
async def lifespan(app):
    await pdf_renderer.start()

    # Start a background asyncio task to purge old chat threads every 7 days.
    purge_task = None

    async def _purge_worker():
        try:
            loop = asyncio.get_event_loop()
            while True:
                # run the synchronous purge in a thread to avoid blocking
                await loop.run_in_executor(None, purge_old_threads, 7)
                await asyncio.sleep(7 * 24 * 3600)
        except asyncio.CancelledError:
            return

    purge_task = asyncio.create_task(_purge_worker())

    try:
        yield
    finally:
        if purge_task:
            purge_task.cancel()
            try:
                await purge_task
            except Exception:
                pass
        await pdf_renderer.stop()
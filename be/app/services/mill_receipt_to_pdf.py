import io
from PIL import Image
from app.core.exceptions import UnsupportedFileTypeError

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pillow_heif = None


def convert_to_pdf(file_bytes: bytes, filename: str) -> io.BytesIO:
    """
    Takes raw file bytes + the original filename, returns a BytesIO containing
    a single-page (or unchanged, if already a PDF) PDF ready to upload to R2.

    Supported inputs: .pdf (passthrough), .jpg/.jpeg, .png, .heic/.heif,
    plus anything else Pillow can open (bmp, tiff, webp, gif, etc).
    """
    ext = (filename.rsplit(".", 1)[-1] if filename and "." in filename else "").lower()

    if ext == "pdf":
        return io.BytesIO(file_bytes)

    try:
        image = Image.open(io.BytesIO(file_bytes))
        image.load()
    except Exception as e:
        raise UnsupportedFileTypeError() from e

    if image.mode != "RGB":
        image = image.convert("RGB")

    pdf_buffer = io.BytesIO()
    image.save(pdf_buffer, format="PDF")
    pdf_buffer.seek(0)
    return pdf_buffer
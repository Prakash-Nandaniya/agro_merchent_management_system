from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError


# ═══════════════════════════ Base Exception ═══════════════════════════
class AppException(Exception):
    """Base class — all custom exceptions inherit from this."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


# ═══════════════════════════ Shared 400 base ═══════════════════════════
class BadRequestError(AppException):
    """Base for all 400-level errors. Subclasses just build `detail`."""

    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


# ═══════════════════════════ Generic "not found" ═══════════════════════════
class NotFoundError(AppException):
    """Raise when a requested record does not exist."""

    def __init__(self, resource: str = "Record", identifier: str = "", detail: str = ""):
        if not detail:
            detail = f"{resource} not found" + (f": '{identifier}'" if identifier else ".")
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


# ═══════════════════════════ Database-layer exceptions ═══════════════════════════
class DuplicateEntryError(AppException):
    """Raise when a UNIQUE constraint is violated (e.g. duplicate invoice_no)."""

    def __init__(self, field: str = "", value: str = "", detail: str = ""):
        if not detail:
            detail = (
                f"A record with {field} '{value}' already exists."
                if field
                else "This record already exists."
            )
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class ForeignKeyViolationError(BadRequestError):
    """Raise when a related record referenced by a FK doesn't exist (e.g. bill_id)."""

    def __init__(self, detail: str = "Referenced record does not exist or is linked to other data."):
        super().__init__(detail=detail)


class DatabaseConnectionError(AppException):
    """Raise when the database is unreachable / connection pool exhausted / timeout."""

    def __init__(self, detail: str = "Could not connect to the database. Please try again shortly."):
        super().__init__(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


class DatabaseOperationError(AppException):
    """Raise for any unexpected DB error not covered by a more specific exception above."""

    def __init__(self, detail: str = "A database error occurred while processing your request."):
        super().__init__(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)


class DatabaseOperationException(AppException):
    def __init__(self, message: str = "Database server error, please try again later"):
        super().__init__(status_code=500, detail=message)


# ═══════════════════════════ PDF Generation error ═══════════════════════════

class PdfGenerationFailed(AppException):
    """Raise when the pdf generation fails."""

    def __init__(self, detail: str):
        super().__init__(status_code=500, detail=detail)


class MillReceiptNotFoundError(NotFoundError):
    """Raised when a trade has no mill_receipt stored, or the key can't be found."""
    def __init__(self):
        super().__init__(resource="Mill Receipt")


# ═══════════════════════════ R2 storage exceptions ═══════════════════════════
# These now inherit AppException so they're caught by the app_exception_handler
# below and return their real `detail` message with a proper status code —
# previously they were plain Exception, so they fell through to the generic
# handler and always returned a bare "Internal server error".

class R2UploadException(AppException):
    """Raised when uploading a file to R2 fails."""
    def __init__(self, detail: str = "Failed to upload mill receipt to storage."):
        super().__init__(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)


class R2DeleteException(AppException):
    """Raised when deleting a file from R2 fails."""
    def __init__(self, detail: str = "Failed to delete mill receipt from storage."):
        super().__init__(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)


class R2FetchException(AppException):
    """Raised when fetching a file / generating a presigned URL from R2 fails."""
    def __init__(self, detail: str = "Failed to fetch mill receipt from storage."):
        super().__init__(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)


class UnsupportedFileTypeError(BadRequestError):
    """Raised when an uploaded mill receipt is not a readable image or PDF.
    This is a client-input problem, so it inherits BadRequestError (400)
    rather than a 502 — the file itself is bad, R2 was never involved."""
    def __init__(self, detail: str = "Unsupported file type. Please upload a PDF, JPG, JPEG, PNG, or HEIC file."):
        super().__init__(detail=detail)

# ═══════════════════════════ Business / validation exceptions ═══════════════════════════
class MissingCropRowsError(BadRequestError):
    """Raise when a bill is submitted with no crop rows filled in."""

    def __init__(self, detail: str = "At least one crop row is required to save a bill."):
        super().__init__(detail=detail)


class InvalidPANError(BadRequestError):
    """Raise when a PAN fails format validation."""

    def __init__(self, pan: str = "", detail: str = ""):
        if not detail:
            detail = f"Invalid PAN format: '{pan}'. Expected format e.g. ABCDE1234F."
        super().__init__(detail=detail)


class InvalidGSTINError(BadRequestError):
    """Raise when a GSTIN fails format validation."""

    def __init__(self, gstin: str = "", detail: str = ""):
        if not detail:
            detail = f"Invalid GSTIN format: '{gstin}'."
        super().__init__(detail=detail)


class InvalidIFSCError(BadRequestError):
    """Raise when an IFSC code fails format validation."""

    def __init__(self, ifsc: str = "", detail: str = ""):
        if not detail:
            detail = f"Invalid IFSC format: '{ifsc}'. Expected format e.g. HDFC0001234."
        super().__init__(detail=detail)


class InvalidCropRowError(BadRequestError):
    """Raise when a crop row has invalid data (e.g. negative qty/rate)."""

    def __init__(self, crop: str = "", field: str = "", detail: str = ""):
        if not detail:
            detail = f"Invalid value for '{field}' in crop '{crop}'."
        super().__init__(detail=detail)


class DeliveryThroughMissing(BadRequestError):
    """Raise when the 'delivery_through' field is missing or empty."""

    def __init__(self, detail: str = "Delivery through is required."):
        super().__init__(detail=detail)


class UQCIsMissing(BadRequestError):
    """Raise when the 'uqc' field is missing or empty."""

    def __init__(self, detail: str = "UQC is missing"):
        super().__init__(detail=detail)


class BlankFieldError(BadRequestError):
    """Raise when a required string field is empty or whitespace-only."""

    def __init__(self, field_name: str, detail: str = ""):
        if not detail:
            detail = f"'{field_name}' must not be blank."
        super().__init__(detail=detail)


class InvalidDateFormatError(BadRequestError):
    """Raise when a date string doesn't match the expected format."""

    def __init__(self, field_name: str, expected_format: str = "YYYY-MM-DD", detail: str = ""):
        if not detail:
            detail = f"'{field_name}' must be in {expected_format} format."
        super().__init__(detail=detail)


class InvalidNumberError(BadRequestError):
    """Raise when a value can't be parsed into a valid decimal number."""

    def __init__(self, field_name: str, detail: str = ""):
        if not detail:
            detail = f"'{field_name}' must be a valid number."
        super().__init__(detail=detail)


class NonPositiveValueError(BadRequestError):
    """Raise when a field that must be strictly positive is zero or negative."""

    def __init__(self, field_name: str, detail: str = ""):
        if not detail:
            detail = f"'{field_name}' must be greater than 0."
        super().__init__(detail=detail)


class NegativeValueError(BadRequestError):
    """Raise when a field that must be non-negative is below zero."""

    def __init__(self, field_name: str, detail: str = ""):
        if not detail:
            detail = f"'{field_name}' must not be negative."
        super().__init__(detail=detail)


class InvalidFieldTypeError(BadRequestError):
    """Raise when a field's input type isn't a string, number, or expected type."""

    def __init__(self, field_name: str, expected: str, detail: str = ""):
        if not detail:
            detail = f"'{field_name}' must be a {expected}."
        super().__init__(detail=detail)

# ═══════════════════════════ Helper: translate raw SQLAlchemy errors ═══════════════════════════

def translate_integrity_error(exc: IntegrityError):
    """
    Inspect a raw SQLAlchemy IntegrityError (usually wrapping a psycopg2 error)
    and convert it into the right AppException subclass:

        try:
            db.commit()
        except IntegrityError as e:
            db.rollback()
            raise translate_integrity_error(e) from e
    """
    orig = getattr(exc, "orig", None)
    pgcode = getattr(orig, "pgcode", None)
    message = str(orig or exc)

    # 1. Catch Unique Constraint Violations (Already Exists)
    if pgcode == "23505" or "unique constraint" in message.lower():
        # Specifically catch duplicate invoice numbers
        # (Replace 'trades_invoice_no_key' with your actual unique constraint name if different)
        if "invoice_no" in message.lower() or "trades_invoice_no_key" in message:
            return DuplicateEntryError(
                detail="Trade entry with this invoice number already exists. Please search for it in the tradebook and edit it if needed."
            )
        
        # Generic fallback for other duplicate fields
        return DuplicateEntryError(
            detail="Duplicate entry detected: A record with this exact information already exists."
        )

    # 2. Catch Foreign Key Violations (Missing Parent Record)
    if pgcode == "23503" or "foreign key constraint" in message.lower():
        # Specifically catch the missing Mill Bill error
        if "trades_invoice_no_fkey" in message:
            return ForeignKeyViolationError(
                detail="Invalid Invoice Number: This Mill Bill does not exist yet. Please create the Mill Bill first before adding this trade."
            )
        
        # Generic fallback for other missing references
        return ForeignKeyViolationError(
            detail="Referenced record missing: You are trying to use an item or ID that does not exist in the system."
        )

    # 3. Catch Not Null Violations (Missing Required Field)
    if pgcode == "23502" or "not null constraint" in message.lower():
        return DatabaseOperationError(
            detail="Missing required field: Please make sure all mandatory fields are filled out."
        )

    # 4. Fallback for any other database integrity issues
    return DatabaseOperationError(detail=f"Database integrity error: {message}")

# ═══════════════════════════ Auth Exceptions ═══════════════════════════
class InvalidCredentialsException(AppException):
    def __init__(self, message: str = "Invalid username or password"):
        super().__init__(status_code=401, detail=message)


class NotAuthenticatedException(AppException):
    def __init__(self, message: str = "User not authenticated"):
        super().__init__(status_code=401, detail=message)


class UserNotFoundException(AppException):
    def __init__(self, message: str = "User not found"):
        super().__init__(status_code=404, detail=message)

# ═══════════════════════════ Exception Handlers ═══════════════════════════
def add_exception_handlers(app: FastAPI):
    """Register exception handlers with FastAPI app."""

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = exc.errors()
        if errors:
            first = errors[0]
            field = first["loc"][-1] if first.get("loc") else "field"
            detail = f"'{field}' is required."
        else:
            detail = "Invalid request."
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": detail},
        )

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        """Handle all AppException subclasses (custom, expected errors)."""
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        """Handle unexpected errors."""
        print(f"Unhandled error on {request.url}: {exc}")  # TODO: replace with proper logger
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )
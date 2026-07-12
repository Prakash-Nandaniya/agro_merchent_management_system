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
        super().__init__(message, status_code=500)
        
        

# ═══════════════════════════ PDF Generation error ═══════════════════════════

class PdfGenerationFailed(AppException):
    """Raise when the pdf generation fails."""

    def __init__(self, detail: str ):
        super().__init__(status_code=500, detail=detail)

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


# ═══════════════════════════ Helper: translate raw SQLAlchemy errors ═══════════════════════════
def translate_integrity_error(exc: IntegrityError) -> AppException:
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

    # Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
    if pgcode == "23505" or "unique constraint" in message.lower():
        return DuplicateEntryError(detail="Duplicate Invoice Number")
    if pgcode == "23503" or "foreign key constraint" in message.lower():
        return ForeignKeyViolationError(detail=f"Foreign key constraint failed: {message}")
    if pgcode == "23502" or "not null constraint" in message.lower():
        return DatabaseOperationError(detail=f"A required field was missing: {message}")

    return DatabaseOperationError(detail=f"Database integrity error: {message}")

# ═══════════════════════════ Auth Exceptions ═══════════════════════════
class InvalidCredentialsException(AppException):
    def __init__(self, message: str = "Invalid username or password"):
        super().__init__(message, status_code=401)


class NotAuthenticatedException(AppException):
    def __init__(self, message: str = "User not authenticated"):
        super().__init__(message, status_code=401)


class UserNotFoundException(AppException):
    def __init__(self, message: str = "User not found"):
        super().__init__(message, status_code=404)

# ═══════════════════════════ Exception Handlers ═══════════════════════════
def add_exception_handlers(app: FastAPI):
    """Register exception handlers with FastAPI app."""

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle request validation errors (bad/missing fields from Pydantic)."""
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": exc.errors()},
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
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.services.security import decode_access_token
from app.core.exceptions import AppException

EXEMPT_PATHS = {"/login", "/docs", "/openapi.json", "/redoc"}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        token = request.cookies.get("access_token")
        if token is None:
            return JSONResponse(status_code=401, content={"detail": "User not authenticated"})

        try:
            payload = decode_access_token(token)  # signature + expiry check only, no DB
        except AppException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})
        except Exception:
            return JSONResponse(status_code=401, content={"detail": "User not authenticated"})

        request.state.current_user = payload["session_id"]

        return await call_next(request)
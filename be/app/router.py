from fastapi import APIRouter
from app.routes.profile_configuration import router as profile_configuration
from app.routes.invoice import router as invoice
from app.routes.user import router as user
from app.routes.generate_pdf import router as PDFGeneration
from app.routes.trade import router as Trade
api_router = APIRouter()

api_router.include_router(profile_configuration, tags=["Profile_Configuration"])
api_router.include_router(invoice, tags=["Invoice"])
api_router.include_router(user, tags=["Authentication"])
api_router.include_router(PDFGeneration, tags=["PDF_Generation"])
api_router.include_router(Trade,tags=["Trade management"])
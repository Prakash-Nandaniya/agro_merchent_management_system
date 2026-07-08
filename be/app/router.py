from fastapi import APIRouter
from app.routes.profile_configuration import router as profile_configuration
from app.routes.mill_bill import router as mill_bill
api_router = APIRouter()

api_router.include_router(profile_configuration, tags=["Profile_Configuration"])
api_router.include_router(mill_bill, tags=["Mill_Bill"])
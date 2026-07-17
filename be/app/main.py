from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.router import api_router
from app.core.exceptions import add_exception_handlers
from app.services.middleware import AuthMiddleware
from app.services.generate_pdf import pdf_renderer, lifespan
from app.core.config import settings

app = FastAPI(title="Back-End", description="Backend API for the application",lifespan=lifespan)

add_exception_handlers(app)

app.add_middleware(AuthMiddleware)        

lst_of_origins=settings.FE_URL.split(",")

app.add_middleware(
    CORSMiddleware,                        
    allow_origins=lst_of_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/health")
async def health_check():
    return {"status": "alive"}
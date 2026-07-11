from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.router import api_router
from app.core.exceptions import add_exception_handlers
from app.services.middleware import AuthMiddleware 

app = FastAPI(title="Back-End", description="Backend API for the application")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

add_exception_handlers(app)

app.add_middleware(AuthMiddleware)

app.include_router(api_router)

@app.get("/health")
async def health_check():
    return {"status": "alive"}
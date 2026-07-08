from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.crud.profile_configuration import get_profile, update_profile
from app.schemas.profile_configuration import ProfileConfigSchema

router = APIRouter()


@router.get("/profile-configuration", response_model=ProfileConfigSchema)
async def get_profile_configuration(db: Session = Depends(get_db)):
    profile = get_profile(db)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile configuration not found.")
    return profile.configuration


@router.put("/profile-configuration", response_model=ProfileConfigSchema)
async def update_profile_configuration(
    profile_configuration: ProfileConfigSchema, db: Session = Depends(get_db)
):
    updated_profile = update_profile(db, profile_configuration)
    return updated_profile.configuration

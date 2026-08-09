from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.database.crud.profile_configuration import get_configuration, update_configuration
from app.schemas.profile_configuration import ProfileConfigSchema

router = APIRouter()


@router.get("/profile-configuration", response_model=dict)
async def get_profile_configuration(db: AsyncSession = Depends(get_db)):
    profile = await db.run_sync(get_configuration)
    return profile


@router.put("/profile-configuration", response_model=ProfileConfigSchema)
async def update_profile_configuration(
    profile_configuration: ProfileConfigSchema, db: AsyncSession = Depends(get_db)
):
    updated_profile = await db.run_sync(update_configuration, profile_configuration)
    return updated_profile

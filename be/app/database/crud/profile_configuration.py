from sqlalchemy.orm import Session
from app.database.models.profile_configuration import ProfileConfiguration

def get_profile(db: Session):
    return db.query(ProfileConfiguration).first()

def update_profile(db: Session, config_data: dict):
    profile = db.query(ProfileConfiguration).first()
    if profile:
        profile.configuration = config_data.model_dump()
        db.commit()
        db.refresh(profile)
        return profile
    else:
        new_profile = ProfileConfiguration(configuration=config_data.model_dump())
        db.add(new_profile)
        db.commit()
        db.refresh(new_profile)
        return new_profile
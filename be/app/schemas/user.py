from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    current_session_user_name: str = Field(..., min_length=1)  
    user_name: str = Field(..., min_length=1)                   
    password: str = Field(..., min_length=1)
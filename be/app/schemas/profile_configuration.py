from pydantic import BaseModel
from typing import List, Dict

class SellerSchema(BaseModel):
    name: str
    address: str
    pan: str
    gstin: str

class BankSchema(BaseModel):
    bank: str
    account: str
    ifsc: str

class CropSchema(BaseModel):
    hsn: str
    cgst: str
    sgst: str

class ProfileConfigSchema(BaseModel):
    seller: SellerSchema
    bank_accounts: List[BankSchema]
    crops: Dict[str, CropSchema] 
    terms_and_conditions: str
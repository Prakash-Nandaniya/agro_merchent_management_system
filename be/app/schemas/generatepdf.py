from typing import List, Optional
from pydantic import BaseModel, Field


class BillCrop(BaseModel):
    id: int
    crop: str
    hsn_code: str
    qty: str
    uqc: str
    rate: str
    taxable_value: str
    cgst_rate: str
    sgst_rate: str
    cgst_amount: str
    sgst_amount: str
    final_amount: str


class MillBill(BaseModel):
    seller_name: str
    seller_address: str
    seller_pan: str
    seller_gstin: str
    invoice_no: str
    invoice_date: str
    docket_no: Optional[str] = None
    transport_name: Optional[str] = None
    delivery_through: str
    party_name: str
    party_address: str
    party_city: Optional[str] = None
    party_state: str
    party_gstin: str
    party_pan: str
    seller_bank: Optional[str] = None
    seller_account: Optional[str] = None
    seller_ifsc: Optional[str] = None
    final_taxable_amount: str
    final_cgst_amount: str
    final_sgst_amount: str
    final_amount: str
    final_amount_in_words: str
    terms: str
    crops: List[BillCrop] = Field(default_factory=list)
    created_by: str
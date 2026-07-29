# scripts/create_first_account.py
import uuid
from app.services.security import hash_password
from app.database.models.account import Account
from app.database.session import SessionLocal

db = SessionLocal()

account = Account(
    id=uuid.uuid4(),
    user_name="karmatrading",
    password=hash_password("karmatrading_baloch"),
    configuration={
        "seller": {"name": "", "address": "", "pan": "", "gstin": ""},
        "bank_accounts": [],
        "crops": {},
        "terms_and_conditions": "As per provided in the Quotation and Order Form.",
    },
    last_millbill_invoiceNo="0",
)

db.add(account)
db.commit()
db.refresh(account)

print(f"Created account: {account.user_name} (id={account.id})")

db.close()

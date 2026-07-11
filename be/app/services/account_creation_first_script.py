# scripts/create_first_account.py
import uuid
from app.services.security import hash_password
from app.database.models.account import Account
from app.database.session import SessionLocal  # ADJUST to your actual sync sessionmaker

db = SessionLocal()

account = Account(
    id=uuid.uuid4(),                       # generated here, in Python
    user_name="karmatrading",
    password=hash_password("karmatrading_baloch"),
    configuration={},
    last_millbill_invoiceNo="0",        
)

db.add(account)
db.commit()
db.refresh(account)

print(f"Created account: {account.user_name} (id={account.id})")

db.close()
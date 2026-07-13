from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)

newpassword=input("Enter new Password: ")

hashedpassword=hash_password(newpassword)

print("new hashed password is: "+hashedpassword)
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/auth/login')


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail='AUTH_REQUIRED')
    user = db.scalar(select(User).where(User.id == int(user_id)))
    if not user:
        raise HTTPException(status_code=401, detail='AUTH_REQUIRED')
    return user

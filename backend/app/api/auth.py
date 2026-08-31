from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models import Account, User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserProfile
from app.api.deps import get_current_user

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/register', response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.username == payload.username)):
        raise AppError('USERNAME_TAKEN', '用户名已存在', 400)
    if db.scalar(select(User).where(User.email == payload.email)):
        raise AppError('EMAIL_TAKEN', '邮箱已存在', 400)

    user = User(username=payload.username, email=payload.email, password_hash=get_password_hash(payload.password))
    db.add(user)
    db.flush()

    initial_cash = Decimal(get_settings().INITIAL_CASH)
    account = Account(
        user_id=user.id,
        initial_cash=initial_cash,
        cash=initial_cash,
        frozen_cash=Decimal('0'),
        market_value=Decimal('0'),
        total_assets=initial_cash,
        total_profit=Decimal('0'),
        total_return=Decimal('0'),
    )
    db.add(account)
    db.commit()
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.post('/login', response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not verify_password(payload.password, user.password_hash):
        raise AppError('AUTH_REQUIRED', '用户名或密码错误', 401)
    user.last_login = datetime.utcnow()
    db.commit()
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.get('/me', response_model=UserProfile)
def me(current_user: User = Depends(get_current_user)):
    return UserProfile.model_validate(current_user, from_attributes=True)

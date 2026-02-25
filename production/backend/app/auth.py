"""
Autenticació i autorització JWT per al backend.
El Dashboard (/api/v1/dashboard i /api/v1/leads) requereix token d'admin.
Endpoint de login: POST /api/v1/auth/login
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import get_settings

logger = logging.getLogger(__name__)

# ──── Config ──────────────────────────────────────────────────────────────────
settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

ALGORITHM = settings.JWT_ALGORITHM
SECRET_KEY = settings.JWT_SECRET_KEY
TOKEN_EXPIRE_MINUTES = settings.JWT_EXPIRATION_MINUTES


# ──── Schemas ─────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = TOKEN_EXPIRE_MINUTES * 60


class TokenData(BaseModel):
    username: Optional[str] = None
    is_admin: bool = False


# ──── Helpers JWT ─────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        is_admin: bool = payload.get("is_admin", False)
        if not username:
            raise ValueError("Token invàlid: sense sub")
        return TokenData(username=username, is_admin=is_admin)
    except JWTError as e:
        logger.warning(f"JWT error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invàlid o expirat",
            headers={"WWW-Authenticate": "Bearer"},
        )


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ──── Dependencies ────────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> TokenData:
    """Valida el token JWT. Requerit per qualsevol ruta protegida."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cal autenticació (Bearer token)",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_token(credentials.credentials)


async def require_admin(
    current_user: TokenData = Depends(get_current_user),
) -> TokenData:
    """Dependency que verifica que l'usuari és administrador.
    Protegeix /app/dashboard i les rutes de gestió."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accés restringit: cal ser administrador",
        )
    return current_user


# ──── Login endpoint handler ──────────────────────────────────────────────────

async def authenticate_admin(data: LoginRequest, db: AsyncSession) -> TokenResponse:
    """Verifica credencials contra la BD i retorna un JWT d'admin."""
    from app.models import AdminUser

    result = await db.execute(
        select(AdminUser).where(AdminUser.username == data.username, AdminUser.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        logger.warning(f"Login fallit per: {data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credencials incorrectes",
        )

    token = create_access_token({
        "sub": user.username,
        "is_admin": user.is_admin,
        "email": user.email,
    })
    logger.info(f"Login correcte: {user.username} (admin={user.is_admin})")
    return TokenResponse(access_token=token)

"""
Auth & multi-tenancy (Phase 7).

Every protected endpoint resolves a `Principal` (tenant_id + role) from a JWT.
Tokens are minted two ways:
  - admin login (email/password) → role="admin"
  - tenant API-key exchange      → role="user"  (what a widget uses)

Tokens that predate Phase 7 (no tenant_id claim) fall back to the default
tenant so older callers/tests keep working.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import get_settings

# auto_error=False so we can return our own 401 (rather than HTTPBearer's 403)
# when the Authorization header is missing entirely.
bearer = HTTPBearer(auto_error=False)


@dataclass
class Principal:
    tenant_id: str
    role: str
    sub: str


def create_access_token(data: dict) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {**data, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def issue_tenant_token(tenant_id: str, api_key: str) -> str:
    """Exchange a tenant API key for a scoped user token, or raise 401."""
    settings = get_settings()
    expected = settings.tenant_api_keys.get(tenant_id)
    if expected is None or api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid tenant or API key")
    return create_access_token({"sub": f"widget@{tenant_id}", "tenant_id": tenant_id, "role": "user"})


def _decode(credentials: HTTPAuthorizationCredentials | None) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    settings = get_settings()
    try:
        return jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> Principal:
    payload = _decode(credentials)
    settings = get_settings()
    return Principal(
        tenant_id=payload.get("tenant_id", settings.default_tenant),
        role=payload.get("role", "user"),
        sub=payload.get("sub", ""),
    )


def require_admin(principal: Principal = Depends(get_principal)) -> Principal:
    if principal.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return principal


# Backwards-compatible alias used by existing analytics endpoints/tests.
def get_current_admin(principal: Principal = Depends(require_admin)) -> Principal:
    return principal

from fastapi import Depends, HTTPException, Request
from backend.services.supabase import get_supabase


async def get_current_user_id(request: Request) -> str:
    """Extract authenticated user ID from Supabase JWT."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ", 1)[1]
    sb = get_supabase()

    try:
        user_response = sb.auth.get_user(token)
        return user_response.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

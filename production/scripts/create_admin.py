"""
Script per crear el primer usuari administrador a la base de dades de producció.
Ús: python production/scripts/create_admin.py <username> <email> <password>
"""
import asyncio
import sys
import os

# Afegir el path per poder importar app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from sqlalchemy import select
from app.database import engine
from app.models import AdminUser, Base
from app.auth import hash_password

async def create_admin(username, email, password):
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        # Verificar si ja existeix
        result = await session.execute(select(AdminUser).where(AdminUser.username == username))
        existing = result.scalar_one_or_none()
        
        if existing:
            print(f"❌ L'usuari '{username}' ja existeix.")
            return

        print(f"⌛ Creant usuari admin: {username} ({email})...")
        
        # Assegurar que les taules existeixen
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        admin = AdminUser(
            username=username,
            email=email,
            password_hash=hash_password(password),
            is_admin=True,
            is_active=True
        )
        
        session.add(admin)
        await session.commit()
        print(f"✅ Usuari '{username}' creat correctament.")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Ús: python production/scripts/create_admin.py <username> <email> <password>")
        sys.exit(1)
    
    u, e, p = sys.argv[1], sys.argv[2], sys.argv[3]
    asyncio.run(create_admin(u, e, p))

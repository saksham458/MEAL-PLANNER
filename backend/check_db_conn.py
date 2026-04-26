import asyncio
import os
from dotenv import load_dotenv
import aiomysql

load_dotenv()

async def check_db():
    host = os.getenv("DB_HOST", "localhost")
    port = int(os.getenv("DB_PORT", "3306"))
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "")
    db = os.getenv("DB_NAME", "smartmeal")
    
    print(f"Connecting to {user}@{host}:{port}/{db}...")
    try:
        conn = await aiomysql.connect(host=host, port=port, user=user, password=password, db=db)
        print("✅ Successfully connected to MySQL!")
        conn.close()
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(check_db())

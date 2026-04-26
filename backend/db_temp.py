import asyncio
import aiomysql
import os

async def migrate():
    # Attempt to connect to the MySQL database described in docker-compose
    # Since frontend has NEXT_PUBLIC_API_URL=http://localhost:8000, backend connects via localhost.
    conn = await aiomysql.connect(
        host='127.0.0.1',
        port=3306,
        user='root',
        password='supersecret',
        db='smartmeal'
    )
    async with conn.cursor() as cur:
        await cur.execute("""
            CREATE TABLE IF NOT EXISTS User_Carts (
                user_id INT PRIMARY KEY,
                cart_json JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES Users(id)
            )
        """)
        await conn.commit()
    conn.close()
    print("Migration successful")

if __name__ == "__main__":
    asyncio.run(migrate())

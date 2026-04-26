import asyncio
import aiomysql

async def migrate():
    try:
        conn = await aiomysql.connect(
            host='127.0.0.1',
            port=3306,
            user='root',
            password='supersecret',
            db='smartmeal'
        )
        async with conn.cursor() as cur:
            # Check if column exists
            await cur.execute("SHOW COLUMNS FROM users LIKE 'phone_number'")
            res = await cur.fetchone()
            if not res:
                print("Adding phone_number column...")
                await cur.execute("ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) UNIQUE DEFAULT NULL AFTER email")
                await conn.commit()
                print("Migration successful")
            else:
                print("phone_number column already exists")
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())

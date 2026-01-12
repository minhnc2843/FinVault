from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ===== ENUMS =====
class TransactionType(str, Enum):
    EXPENSE = "expense"
    INCOME = "income"

class SplitType(str, Enum):
    EQUAL = "equal"
    CUSTOM = "custom"

class FriendshipStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"

# ===== MODELS =====
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    currency_preference: str = "VND"
    usd_vnd_rate: float = 25000.0
    created_at: datetime

class UserSettings(BaseModel):
    currency_preference: Optional[str] = None
    usd_vnd_rate: Optional[float] = None
    avatar_url: Optional[str] = None

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    name: str
    icon: str
    color: str
    type: TransactionType
    is_default: bool = False
    created_at: datetime

class CategoryCreate(BaseModel):
    name: str
    icon: str
    color: str
    type: TransactionType

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    category_id: str
    amount: float
    currency: str
    description: str
    date: datetime
    receipt_url: Optional[str] = None
    tags: List[str] = []
    is_shared: bool = False
    shared_expense_id: Optional[str] = None
    created_at: datetime

class TransactionCreate(BaseModel):
    category_id: str
    amount: float
    currency: str
    description: str
    date: datetime
    receipt_url: Optional[str] = None
    tags: List[str] = []

class SharedExpenseParticipant(BaseModel):
    user_id: str
    email: str
    full_name: str
    amount: float
    paid: float = 0.0
    confirmed: bool = False

class SharedExpense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    description: str
    total_amount: float
    currency: str
    creator_id: str
    participants: List[SharedExpenseParticipant]
    split_type: SplitType
    status: str
    category_id: Optional[str] = None
    date: datetime
    receipt_url: Optional[str] = None
    created_at: datetime

class SharedExpenseCreate(BaseModel):
    title: str
    description: str
    total_amount: float
    currency: str
    participant_emails: List[str]
    split_type: SplitType = SplitType.EQUAL
    category_id: Optional[str] = None
    date: datetime
    receipt_url: Optional[str] = None

class Friendship(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    friend_id: str
    friend_email: str
    friend_name: str
    status: FriendshipStatus
    created_at: datetime

class FriendRequest(BaseModel):
    friend_email: EmailStr

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    type: str
    content: str
    read: bool = False
    created_at: datetime

class Budget(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    category_id: str
    amount: float
    period: str
    created_at: datetime

class BudgetCreate(BaseModel):
    category_id: str
    amount: float
    period: str = "monthly"

# ===== AUTH UTILITIES =====
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**user)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# ===== AUTH ROUTES =====
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "full_name": user_data.full_name,
        "avatar_url": None,
        "currency_preference": "VND",
        "usd_vnd_rate": 25000.0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create default categories
    default_categories = [
        {"name": "Ăn uống", "icon": "UtensilsCrossed", "color": "#F59E0B", "type": "expense"},
        {"name": "Di chuyển", "icon": "Car", "color": "#3B82F6", "type": "expense"},
        {"name": "Mua sắm", "icon": "ShoppingBag", "color": "#EC4899", "type": "expense"},
        {"name": "Giải trí", "icon": "Gamepad2", "color": "#8B5CF6", "type": "expense"},
        {"name": "Sức khỏe", "icon": "Heart", "color": "#EF4444", "type": "expense"},
        {"name": "Hóa đơn", "icon": "Receipt", "color": "#6366F1", "type": "expense"},
        {"name": "Lương", "icon": "Wallet", "color": "#10B981", "type": "income"},
        {"name": "Khác", "icon": "MoreHorizontal", "color": "#64748B", "type": "expense"},
    ]
    
    for cat in default_categories:
        cat_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "is_default": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            **cat
        }
        await db.categories.insert_one(cat_doc)
    
    # Create token
    access_token = create_access_token({"sub": user_id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": user_data.email,
            "full_name": user_data.full_name
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token({"sub": user["id"]})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"]
        }
    }

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ===== USER ROUTES =====
@api_router.put("/users/profile", response_model=User)
async def update_profile(settings: UserSettings, current_user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in settings.model_dump().items() if v is not None}
    
    if update_data:
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if isinstance(updated_user['created_at'], str):
        updated_user['created_at'] = datetime.fromisoformat(updated_user['created_at'])
    return User(**updated_user)

@api_router.get("/users/search")
async def search_users(q: str, current_user: User = Depends(get_current_user)):
    users = await db.users.find(
        {
            "$or": [
                {"email": {"$regex": q, "$options": "i"}},
                {"full_name": {"$regex": q, "$options": "i"}}
            ],
            "id": {"$ne": current_user.id}
        },
        {"_id": 0, "password_hash": 0}
    ).to_list(10)
    
    return users

# ===== CATEGORY ROUTES =====
@api_router.get("/categories", response_model=List[Category])
async def get_categories(current_user: User = Depends(get_current_user)):
    categories = await db.categories.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).to_list(100)
    
    for cat in categories:
        if isinstance(cat['created_at'], str):
            cat['created_at'] = datetime.fromisoformat(cat['created_at'])
    
    return [Category(**cat) for cat in categories]

@api_router.post("/categories", response_model=Category)
async def create_category(category_data: CategoryCreate, current_user: User = Depends(get_current_user)):
    category_id = str(uuid.uuid4())
    category_doc = {
        "id": category_id,
        "user_id": current_user.id,
        "is_default": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **category_data.model_dump()
    }
    
    await db.categories.insert_one(category_doc)
    category_doc['created_at'] = datetime.fromisoformat(category_doc['created_at'])
    return Category(**category_doc)

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: User = Depends(get_current_user)):
    category = await db.categories.find_one({"id": category_id, "user_id": current_user.id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    if category.get("is_default"):
        raise HTTPException(status_code=400, detail="Cannot delete default category")
    
    await db.categories.delete_one({"id": category_id})
    return {"message": "Category deleted"}

# ===== TRANSACTION ROUTES =====
@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions(
    category_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {"user_id": current_user.id}
    
    if category_id:
        query["category_id"] = category_id
    
    if from_date or to_date:
        query["date"] = {}
        if from_date:
            query["date"]["$gte"] = from_date
        if to_date:
            query["date"]["$lte"] = to_date
    
    transactions = await db.transactions.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    
    for txn in transactions:
        if isinstance(txn['created_at'], str):
            txn['created_at'] = datetime.fromisoformat(txn['created_at'])
        if isinstance(txn['date'], str):
            txn['date'] = datetime.fromisoformat(txn['date'])
    
    return [Transaction(**txn) for txn in transactions]

@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(txn_data: TransactionCreate, current_user: User = Depends(get_current_user)):
    txn_id = str(uuid.uuid4())
    txn_doc = {
        "id": txn_id,
        "user_id": current_user.id,
        "is_shared": False,
        "shared_expense_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **txn_data.model_dump()
    }
    
    txn_doc['date'] = txn_doc['date'].isoformat()
    
    await db.transactions.insert_one(txn_doc)
    
    txn_doc['created_at'] = datetime.fromisoformat(txn_doc['created_at'])
    txn_doc['date'] = datetime.fromisoformat(txn_doc['date'])
    return Transaction(**txn_doc)

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, current_user: User = Depends(get_current_user)):
    result = await db.transactions.delete_one({"id": transaction_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Transaction deleted"}

# ===== SHARED EXPENSE ROUTES =====
@api_router.get("/shared-expenses", response_model=List[SharedExpense])
async def get_shared_expenses(current_user: User = Depends(get_current_user)):
    expenses = await db.shared_expenses.find(
        {
            "$or": [
                {"creator_id": current_user.id},
                {"participants.user_id": current_user.id}
            ]
        },
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    
    for exp in expenses:
        if isinstance(exp['created_at'], str):
            exp['created_at'] = datetime.fromisoformat(exp['created_at'])
        if isinstance(exp['date'], str):
            exp['date'] = datetime.fromisoformat(exp['date'])
    
    return [SharedExpense(**exp) for exp in expenses]

@api_router.post("/shared-expenses", response_model=SharedExpense)
async def create_shared_expense(expense_data: SharedExpenseCreate, current_user: User = Depends(get_current_user)):
    # Get participant users
    participants = []
    for email in expense_data.participant_emails:
        user = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 0})
        if user:
            participants.append({
                "user_id": user["id"],
                "email": user["email"],
                "full_name": user["full_name"],
                "amount": 0.0,
                "paid": 0.0,
                "confirmed": False
            })
    
    # Add creator
    participants.append({
        "user_id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "amount": 0.0,
        "paid": expense_data.total_amount,
        "confirmed": True
    })
    
    # Calculate split
    if expense_data.split_type == SplitType.EQUAL:
        amount_per_person = expense_data.total_amount / len(participants)
        for p in participants:
            p["amount"] = round(amount_per_person, 2)
    
    expense_id = str(uuid.uuid4())
    expense_doc = {
        "id": expense_id,
        "creator_id": current_user.id,
        "participants": participants,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "title": expense_data.title,
        "description": expense_data.description,
        "total_amount": expense_data.total_amount,
        "currency": expense_data.currency,
        "split_type": expense_data.split_type,
        "category_id": expense_data.category_id,
        "date": expense_data.date.isoformat(),
        "receipt_url": expense_data.receipt_url
    }
    
    await db.shared_expenses.insert_one(expense_doc)
    
    # Create notifications
    for p in participants:
        if p["user_id"] != current_user.id:
            notif_doc = {
                "id": str(uuid.uuid4()),
                "user_id": p["user_id"],
                "type": "shared_expense_added",
                "content": f"{current_user.full_name} đã thêm bạn vào khoản chi '{expense_data.title}'",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notif_doc)
    
    expense_doc['created_at'] = datetime.fromisoformat(expense_doc['created_at'])
    expense_doc['date'] = datetime.fromisoformat(expense_doc['date'])
    return SharedExpense(**expense_doc)

@api_router.post("/shared-expenses/{expense_id}/confirm")
async def confirm_shared_expense(expense_id: str, current_user: User = Depends(get_current_user)):
    expense = await db.shared_expenses.find_one({"id": expense_id})
    if not expense:
        raise HTTPException(status_code=404, detail="Shared expense not found")
    
    # Update participant confirmation
    participants = expense["participants"]
    updated = False
    for p in participants:
        if p["user_id"] == current_user.id:
            p["confirmed"] = True
            updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=403, detail="You are not a participant")
    
    await db.shared_expenses.update_one(
        {"id": expense_id},
        {"$set": {"participants": participants}}
    )
    
    return {"message": "Confirmed"}

@api_router.get("/shared-expenses/{expense_id}/settlements")
async def get_settlements(expense_id: str, current_user: User = Depends(get_current_user)):
    expense = await db.shared_expenses.find_one({"id": expense_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Shared expense not found")
    
    settlements = []
    for p in expense["participants"]:
        balance = p["paid"] - p["amount"]
        settlements.append({
            "user_id": p["user_id"],
            "user_name": p["full_name"],
            "amount_owed": p["amount"],
            "amount_paid": p["paid"],
            "balance": balance,
            "status": "settled" if balance >= 0 else "owes"
        })
    
    return settlements

# ===== FRIEND ROUTES =====
@api_router.get("/friends", response_model=List[Friendship])
async def get_friends(current_user: User = Depends(get_current_user)):
    friendships = await db.friendships.find(
        {
            "$or": [
                {"user_id": current_user.id},
                {"friend_id": current_user.id}
            ],
            "status": FriendshipStatus.ACCEPTED
        },
        {"_id": 0}
    ).to_list(1000)
    
    result = []
    for f in friendships:
        if isinstance(f['created_at'], str):
            f['created_at'] = datetime.fromisoformat(f['created_at'])
        result.append(Friendship(**f))
    
    return result

@api_router.post("/friends/request")
async def send_friend_request(request: FriendRequest, current_user: User = Depends(get_current_user)):
    friend = await db.users.find_one({"email": request.friend_email})
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")
    
    if friend["id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")
    
    # Check if already friends
    existing = await db.friendships.find_one({
        "$or": [
            {"user_id": current_user.id, "friend_id": friend["id"]},
            {"user_id": friend["id"], "friend_id": current_user.id}
        ]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Friend request already exists")
    
    friendship_id = str(uuid.uuid4())
    friendship_doc = {
        "id": friendship_id,
        "user_id": current_user.id,
        "friend_id": friend["id"],
        "friend_email": friend["email"],
        "friend_name": friend["full_name"],
        "status": FriendshipStatus.PENDING,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.friendships.insert_one(friendship_doc)
    
    # Create notification
    notif_doc = {
        "id": str(uuid.uuid4()),
        "user_id": friend["id"],
        "type": "friend_request",
        "content": f"{current_user.full_name} đã gửi lời mời kết bạn",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notif_doc)
    
    return {"message": "Friend request sent"}

@api_router.post("/friends/{friendship_id}/accept")
async def accept_friend_request(friendship_id: str, current_user: User = Depends(get_current_user)):
    friendship = await db.friendships.find_one({"id": friendship_id})
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    if friendship["friend_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.friendships.update_one(
        {"id": friendship_id},
        {"$set": {"status": FriendshipStatus.ACCEPTED}}
    )
    
    return {"message": "Friend request accepted"}

# ===== NOTIFICATION ROUTES =====
@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(current_user: User = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for notif in notifications:
        if isinstance(notif['created_at'], str):
            notif['created_at'] = datetime.fromisoformat(notif['created_at'])
    
    return [Notification(**notif) for notif in notifications]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: User = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}

# ===== BUDGET ROUTES =====
@api_router.get("/budgets", response_model=List[Budget])
async def get_budgets(current_user: User = Depends(get_current_user)):
    budgets = await db.budgets.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).to_list(100)
    
    for budget in budgets:
        if isinstance(budget['created_at'], str):
            budget['created_at'] = datetime.fromisoformat(budget['created_at'])
    
    return [Budget(**budget) for budget in budgets]

@api_router.post("/budgets", response_model=Budget)
async def create_budget(budget_data: BudgetCreate, current_user: User = Depends(get_current_user)):
    budget_id = str(uuid.uuid4())
    budget_doc = {
        "id": budget_id,
        "user_id": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **budget_data.model_dump()
    }
    
    await db.budgets.insert_one(budget_doc)
    budget_doc['created_at'] = datetime.fromisoformat(budget_doc['created_at'])
    return Budget(**budget_doc)

@api_router.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str, current_user: User = Depends(get_current_user)):
    result = await db.budgets.delete_one({"id": budget_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Budget not found")
    return {"message": "Budget deleted"}

# ===== STATISTICS ROUTES =====
@api_router.get("/statistics/overview")
async def get_statistics_overview(
    period: str = "month",
    current_user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    
    if period == "month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "year":
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = now - timedelta(days=30)
    
    # Get transactions
    transactions = await db.transactions.find({
        "user_id": current_user.id,
        "date": {"$gte": start_date.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    # Calculate totals
    total_expense = 0
    total_income = 0
    
    for txn in transactions:
        categories = await db.categories.find_one({"id": txn["category_id"]}, {"_id": 0})
        if categories:
            if categories["type"] == "expense":
                total_expense += txn["amount"]
            else:
                total_income += txn["amount"]
    
    # Get shared expenses where user owes money
    shared_expenses = await db.shared_expenses.find({
        "participants.user_id": current_user.id
    }, {"_id": 0}).to_list(1000)
    
    total_owed = 0
    for exp in shared_expenses:
        for p in exp["participants"]:
            if p["user_id"] == current_user.id:
                balance = p["paid"] - p["amount"]
                if balance < 0:
                    total_owed += abs(balance)
    
    return {
        "total_expense": round(total_expense, 2),
        "total_income": round(total_income, 2),
        "balance": round(total_income - total_expense, 2),
        "total_owed": round(total_owed, 2),
        "transaction_count": len(transactions)
    }

@api_router.get("/statistics/by-category")
async def get_statistics_by_category(
    period: str = "month",
    current_user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    
    if period == "month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = now - timedelta(days=30)
    
    transactions = await db.transactions.find({
        "user_id": current_user.id,
        "date": {"$gte": start_date.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    # Group by category
    category_totals = {}
    for txn in transactions:
        cat_id = txn["category_id"]
        if cat_id not in category_totals:
            category = await db.categories.find_one({"id": cat_id}, {"_id": 0})
            if category and category["type"] == "expense":
                category_totals[cat_id] = {
                    "category_id": cat_id,
                    "category_name": category["name"],
                    "color": category["color"],
                    "total": 0
                }
        
        if cat_id in category_totals:
            category_totals[cat_id]["total"] += txn["amount"]
    
    result = list(category_totals.values())
    result.sort(key=lambda x: x["total"], reverse=True)
    
    return result

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

"""
Seed the AI Support Agent with sample documents for the live demo.

Usage:
    # Start the backend first, then:
    python evals/seed_demo.py
    python evals/seed_demo.py --url http://localhost:8000
"""

import argparse
import io
import os
import time
from pathlib import Path

import httpx


SAMPLE_DIR = Path(__file__).parent / "sample_docs"
DEFAULT_URL = os.environ.get("EVAL_API_URL", "http://localhost:8000")
TENANT_ID = os.environ.get("EVAL_TENANT_ID", "default")
TENANT_API_KEY = os.environ.get("EVAL_TENANT_API_KEY", "demo-key")


def get_auth_header(client: httpx.Client) -> dict:
    """Exchange the tenant API key for a scoped token (Phase 7 auth)."""
    resp = client.post(
        "/auth/token", json={"tenant_id": TENANT_ID, "api_key": TENANT_API_KEY}
    )
    resp.raise_for_status()
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}

SAMPLE_FILES = {
    "refund_policy.txt": """Refund Policy — Last updated January 2025

We offer a 30-day money-back guarantee on all products.
To initiate a refund, contact support@example.com with your order number.
Refunds are processed within 5-7 business days after we receive the returned item.

Conditions:
- Products must be returned in original condition
- Digital products are non-refundable after download
- Shipping costs are non-refundable
- Refunds are issued to the original payment method

Expedited refunds (24-hour processing) are available for Premium tier customers.
""",

    "support_hours.txt": """Customer Support Hours

Our support team is available:
- Monday through Friday: 9 AM to 6 PM EST
- Saturday: 10 AM to 2 PM EST (Premium only)
- Sunday: Closed

Contact methods:
- Email: support@example.com (response within 4 hours during business hours)
- Live chat: Available on our website during business hours
- Phone: 1-800-555-0199 (Premium customers only)

Enterprise customers with a premium support plan get 24/7 phone support and a dedicated account manager.

Holiday schedule: Support hours may vary on major US holidays. We notify customers 72 hours in advance.
""",

    "shipping_guide.txt": """Shipping Guide

Domestic Shipping (Continental US):
- Standard: 5-7 business days — $4.99
- Express: 2-3 business days — $12.99
- Next Day: 1 business day — $24.99 (orders before 2 PM EST)

International Shipping:
- Standard: 10-14 business days — $14.99
- Express: 5-7 business days — $29.99

Free shipping on orders over $50 (domestic only).

Tracking: All orders include tracking information sent via email.

Customs: International orders may incur customs duties and taxes, which are the responsibility of the recipient.

PO Boxes: We ship to PO boxes via USPS only. Express and Next Day shipping require a physical address.
""",

    "account_guide.txt": """Account Management Guide

Password Reset:
1. Click 'Forgot Password' on the login page
2. Enter your registered email address
3. Check your inbox for a password reset link (arrives within 5 minutes)
4. Click the link and enter your new password
5. Password requirements: minimum 8 characters, 1 uppercase, 1 number

The reset link expires after 1 hour. If it expires, simply request a new one.

Two-Factor Authentication:
- Enable 2FA from Settings > Security
- Supports authenticator apps (Google Authenticator, Authy)
- Backup codes are provided during setup — store them safely

Profile Settings:
- Update your name, email, and profile picture from Settings > Profile
- Email changes require verification via a confirmation link
- Notification preferences are managed from Settings > Notifications
""",

    "api_docs.txt": """API Documentation v2.4

Authentication: All API requests require a Bearer token in the Authorization header.
Get your API key from the Developer Settings page in your account.

Rate Limits:
- Standard tier: 1,000 requests per minute
- Enterprise tier: 10,000 requests per minute
- Rate limits reset every minute
- Exceeded limits return HTTP 429 with a Retry-After header

Endpoints:
- GET /api/v2/users — List users
- POST /api/v2/users — Create user
- GET /api/v2/users/{id} — Get user details
- PUT /api/v2/users/{id} — Update user
- DELETE /api/v2/users/{id} — Delete user

Pagination: All list endpoints use cursor-based pagination.
Response format: All responses are JSON. Errors include an error code and message.
Webhooks: Configure webhooks from the Developer Settings page to receive real-time events.
""",

    "privacy_policy.txt": """Privacy Policy — Last updated January 2025

Data Retention:
- We retain your data for as long as your account is active
- After account deletion, data is permanently removed within 30 days
- Backup retention extends to 90 days for disaster recovery purposes
- Anonymized analytics data may be retained indefinitely

Data Collection:
- Account information: name, email, billing address
- Usage data: pages visited, features used, session duration
- Device information: browser type, operating system, IP address

Data Sharing:
- We never sell your personal data
- Data is shared with service providers necessary for platform operation
- Aggregated, anonymized data may be shared for analytics purposes

Your Rights:
- Access, correct, or delete your data from Settings > Privacy
- Export your data in CSV format
- Close your account from Settings > Account
""",

    "billing_guide.txt": """Billing Guide

Subscription Management:
To cancel your subscription:
1. Go to Settings > Billing
2. Click 'Cancel Subscription'
3. Select a reason for cancellation
4. Confirm cancellation

Your access continues until the end of the current billing period.
No partial refunds are issued for mid-cycle cancellations.

Billing Cycles:
- Monthly: Billed on the same day each month
- Annual: Billed once per year (2 months free vs monthly)
- Enterprise: Custom billing terms

Payment Methods:
- Credit/debit cards (Visa, Mastercard, Amex, Discover)
- PayPal
- Bank transfer (Enterprise only)

Invoices are available for download from Settings > Billing > Invoices.
Update your payment method from Settings > Billing > Payment Method.
""",
}


def seed_documents(url: str) -> list[dict]:
    """Upload all sample documents and return their metadata."""
    client = httpx.Client(base_url=url, timeout=30)
    documents = []

    # Wait for server to be ready
    for attempt in range(10):
        try:
            r = client.get("/health")
            if r.status_code == 200:
                print("  Server ready")
                break
        except Exception:
            pass
        print(f"  Waiting for server (attempt {attempt + 1})…")
        time.sleep(2)

    auth = get_auth_header(client)

    for filename, content in SAMPLE_FILES.items():
        print(f"  Uploading {filename}… ", end="", flush=True)
        files = {"file": (filename, io.BytesIO(content.encode("utf-8")), "text/plain")}
        try:
            resp = client.post("/upload", files=files, headers=auth)
            if resp.status_code == 201:
                data = resp.json()
                documents.append(data)
                print(f"✅ doc_id={data['document_id']}")
            else:
                print(f"❌ {resp.status_code}: {resp.text[:100]}")
        except Exception as e:
            print(f"❌ {e}")

    return documents


def main():
    parser = argparse.ArgumentParser(description="Seed demo documents")
    parser.add_argument("--url", default=DEFAULT_URL, help="Backend API URL")
    args = parser.parse_args()

    print(f"🌱 Seeding demo documents into {args.url}")
    docs = seed_documents(args.url)
    print(f"\n📄 Seeded {len(docs)}/{len(SAMPLE_FILES)} documents successfully")

    if docs:
        print("\n  Next steps:")
        print(f"  1. Open the frontend at {args.url.replace(':8000', ':3000')}")
        print(f"  2. Ask questions like 'What is your refund policy?'")
        print(f"  3. Try an out-of-scope question like 'What are your competitor's prices?'")
        print(f"  4. Check the admin dashboard at {args.url.replace(':8000', ':3000')}/admin")


if __name__ == "__main__":
    main()

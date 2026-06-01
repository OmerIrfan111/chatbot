"""
Eval harness for the AI Support Agent.

Loads the golden Q&A set, sends each question through the live chat
endpoint, and scores answers on groundedness (must_contain/must_not_contain).

Usage:
    python evals/evaluate.py                         # against localhost:8000
    python evals/evaluate.py --url http://host:port   # custom URL
    python evals/evaluate.py --threshold 0.8          # pass threshold

Returns exit code 0 if score >= threshold, 1 otherwise (CI-friendly).
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx

GOLDEN_SET_PATH = Path(__file__).parent / "golden_set.json"
DEFAULT_URL = os.environ.get("EVAL_API_URL", "http://localhost:8000")
PASS_THRESHOLD = float(os.environ.get("EVAL_THRESHOLD", "0.8"))
TENANT_ID = os.environ.get("EVAL_TENANT_ID", "default")
TENANT_API_KEY = os.environ.get("EVAL_TENANT_API_KEY", "demo-key")


def load_golden_set() -> list[dict]:
    with open(GOLDEN_SET_PATH) as f:
        return json.load(f)


def get_auth_header(client: httpx.Client, url: str) -> dict:
    """Exchange the tenant API key for a scoped token (Phase 7 auth)."""
    resp = client.post(
        f"{url}/auth/token", json={"tenant_id": TENANT_ID, "api_key": TENANT_API_KEY}, timeout=30
    )
    resp.raise_for_status()
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def evaluate_item(item: dict, client: httpx.Client, url: str, auth: dict) -> dict:
    """Send a single question and score the answer."""
    question = item["question"]
    category = item.get("category", "unknown")
    lang = item.get("language", "en")

    try:
        resp = client.post(
            f"{url}/chat",
            json={"question": question, "session_id": f"eval-{item['id']}"},
            headers=auth,
            timeout=30,
        )
        if resp.status_code == 400:
            # No documents ingested — try uploading
            return {
                "id": item["id"],
                "question": question,
                "answer": "",
                "category": category,
                "language": lang,
                "passed": False,
                "error": "No documents ingested (400)",
                "refusal_correct": None,
            }

        resp.raise_for_status()
        data = resp.json()
        answer = data.get("answer", "")
        refusal = data.get("refusal", False)
    except Exception as e:
        return {
            "id": item["id"],
            "question": question,
            "answer": "",
            "category": category,
            "language": lang,
            "passed": False,
            "error": str(e)[:200],
            "refusal_correct": None,
        }

    answer_lower = answer.lower()

    # Check must_contain
    must_contain = item.get("must_contain", [])
    must_contains_ok = all(
        mc.lower() in answer_lower for mc in must_contain
    )

    # Check must_not_contain
    must_not_contain = item.get("must_not_contain", [])
    must_not_contains_ok = all(
        mnc.lower() not in answer_lower for mnc in must_not_contain
    )

    # Out-of-scope questions must trigger a refusal.
    if item["reference_answer"] is None:
        refusals = item.get("must_contain", [])
        refusal_hit = any(r.lower() in answer_lower for r in refusals)
        refusal_correct = refusal_hit
        passed = refusal_hit and must_not_contains_ok
    else:
        refusal_correct = None
        passed = must_contains_ok and must_not_contains_ok

    return {
        "id": item["id"],
        "question": question,
        "answer": answer[:200] + ("…" if len(answer) > 200 else ""),
        "category": category,
        "language": lang,
        "passed": passed,
        "must_contain_ok": must_contains_ok,
        "must_not_contain_ok": must_not_contains_ok,
        "refusal_correct": refusal_correct,
        "error": None,
    }


def main():
    parser = argparse.ArgumentParser(description="Eval harness for AI Support Agent")
    parser.add_argument(
        "--url", default=DEFAULT_URL, help="Backend API URL"
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=PASS_THRESHOLD,
        help=f"Minimum pass rate (default: {PASS_THRESHOLD})",
    )
    args = parser.parse_args()

    golden = load_golden_set()
    print(f"🔍 Loaded {len(golden)} golden Q&A items from {GOLDEN_SET_PATH.name}")
    print(f"🎯 Threshold: {args.threshold:.0%}")
    print(f"🌐 Target: {args.url}")
    print()

    client = httpx.Client(base_url=args.url)
    auth = get_auth_header(client, args.url)
    results = []
    failures = []

    for item in golden:
        result = evaluate_item(item, client, args.url, auth)
        results.append(result)

        status = "✅" if result["passed"] else "❌"
        label = f"{status} {result['id']} ({result['category']})"
        print(f"  {label:50s}", end="")

        if result.get("error"):
            print(f"  ⚠ {result['error']}")
        elif result["passed"]:
            print()
        else:
            failures.append(result)
            reasons = []
            if result.get("must_contain_ok") is False:
                reasons.append("must_contain")
            if result.get("must_not_contain_ok") is False:
                reasons.append("must_not_contain")
            if result.get("refusal_correct") is False:
                reasons.append("refusal")
            print(f"  FAIL: {', '.join(reasons)}")

    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    score = passed / total if total > 0 else 0

    print()
    print(f"{'─' * 60}")
    print(f"  Results:  {passed}/{total} passed ({score:.0%})")
    print(f"  Threshold: {args.threshold:.0%}")
    print(f"  Outcome:  {'✅ PASS' if score >= args.threshold else '❌ FAIL'}")

    if failures:
        print(f"\n  Failures ({len(failures)}):")
        for f in failures:
            print(f"    - {f['id']}: {f['question'][:60]}")
            if f.get("error"):
                print(f"      Error: {f['error']}")

    sys.exit(0 if score >= args.threshold else 1)


if __name__ == "__main__":
    main()

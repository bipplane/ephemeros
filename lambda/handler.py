"""AWS Lambda skeleton for Ephemeros ephemeral context retrieval.

Prototype mode returns mock restricted schema. Production wiring should place this
function in a VPC subnet with route access to target EC2/RDS/private endpoints.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
from typing import Any

SAFE_RESOURCE = re.compile(r"^[A-Za-z0-9._:/-]{3,200}$")
ALLOWED_TYPES = {"schema", "docs", "code"}


def _response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body),
    }


def _mock_context(resource_type: str, resource_id: str) -> str:
    if resource_type == "schema" and resource_id == "quant/rates/bond_yields":
        return "\n".join(
            [
                "```sql",
                "CREATE TABLE internal_quant.bond_yields (",
                "  trade_date DATE NOT NULL,",
                "  cusip VARCHAR(9) NOT NULL,",
                "  tenor_years INTEGER NOT NULL,",
                "  yield_bps NUMERIC(10, 4) NOT NULL,",
                "  source_system VARCHAR(32) NOT NULL,",
                "  PRIMARY KEY (trade_date, cusip, tenor_years)",
                ");",
                "```",
            ]
        )

    return f"# Mock {resource_type}\n\nRestricted context for `{resource_id}`."


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    resource_type = event.get("resourceType")
    resource_id = event.get("resourceId")
    purpose = event.get("purpose")

    if resource_type not in ALLOWED_TYPES:
        return _response(400, {"error": "Unsupported resourceType"})
    if (
        not isinstance(resource_id, str)
        or not SAFE_RESOURCE.match(resource_id)
        or resource_id.startswith("/")
        or any(part in {"", ".."} for part in resource_id.split("/"))
    ):
        return _response(400, {"error": "Invalid resourceId"})
    if not isinstance(purpose, str) or len(purpose) < 10:
        return _response(400, {"error": "Invalid purpose"})

    allowed_prefixes = [
        prefix.strip()
        for prefix in os.getenv("EPHEMEROS_ALLOWED_RESOURCE_PREFIXES", "quant/").split(",")
        if prefix.strip()
    ]
    if not any(resource_id.startswith(prefix) for prefix in allowed_prefixes):
        return _response(403, {"error": "Resource not allowed"})

    now = dt.datetime.now(dt.UTC)
    expires_at = now + dt.timedelta(minutes=5)

    return _response(
        200,
        {
            "contextId": event.get("requestId") or f"ctx-{int(now.timestamp())}",
            "content": _mock_context(resource_type, resource_id),
            "expiresAt": expires_at.isoformat().replace("+00:00", "Z"),
            "metadata": {
                "mode": os.getenv("EPHEMEROS_MODE", "mock"),
                "resourceId": resource_id,
                "ttlSeconds": 300,
            },
        },
    )

# Ephemeros Restricted Context

- resourceType: schema
- resourceId: quant/rates/bond_yields
- purpose: IBM Bob needs schema context to write Python query code for historical bond yields
- expiresAt: 2026-05-17T08:23:48.839Z
- dataset: "vpn_synthetic_schema"
- classification: "synthetic-demo"
- connector: "vpn-check"
- remoteContentStored: false
- remoteContentSentToBob: false
- urlHost: "100.82.136.35:8080"
- httpStatus: 200
- checkedAt: "2026-05-17T08:18:48.836Z"

## Retrieved Content

# VPN Synthetic Context

This file is the safe local payload used when VPN reachability succeeds. The remote VPN target is used only for connectivity proof. Its page body is not stored, logged, sent to Bob, or passed to watsonx.ai.

```sql
CREATE TABLE internal_quant.bond_yields (
  trade_date DATE NOT NULL,
  cusip VARCHAR(9) NOT NULL,
  tenor_years INTEGER NOT NULL,
  yield_bps NUMERIC(10, 4) NOT NULL,
  source_system VARCHAR(32) NOT NULL,
  PRIMARY KEY (trade_date, cusip, tenor_years)
);
```

Access rule: queries must filter trade_date by bounded date range and must not select source_system unless requested.

# GAPAK E2EE

GAPAK uses the **GAPAK E2EE protocol v1** custom protocol.

It is **not Signal Protocol** and does not implement Double Ratchet.

For the authoritative protocol, trust model, key lifecycle, device lifecycle, threat model and backend requirements, see:

- `docs/E2EE_SECURITY_MODEL.md`
- `docs/PHASE_3_REPORT.md`

The frontend deliberately fails closed when backend-authenticated device/trust/key state is unavailable.

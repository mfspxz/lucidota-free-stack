# API-surface checklist (audit-kit class: api-surface.md)

- [ ] Auth on every route; 401 shape uniform; no auth on debug routes
- [ ] Fail-closed defaults: unknown input rejected, not accepted
- [ ] Rate limits defined per route class; 429 honest with retry info
- [ ] Input validation: types, ranges, sizes enforced server-side
- [ ] Uniform error shape `{error, code, request_id}`; no stack traces to clients
- [ ] Pagination: bounded page sizes, no unbounded list endpoints
- [ ] Every mutating route idempotent or guarded against replay
- [ ] Admin routes behind separate auth; audit-logged

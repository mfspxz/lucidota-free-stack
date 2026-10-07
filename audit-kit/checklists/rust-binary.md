# Rust-binary checklist (audit-kit class: rust-binary.md)

- [ ] No `.unwrap()`/`.expect()` on prod paths (grep; test-only allowed)
- [ ] Error types with context; no silent `Ok` swallowing failures
- [ ] Graceful shutdown (SIGTERM -> drain -> exit); no half-written state
- [ ] Config from env/args, not literals; secrets never compiled in
- [ ] `cargo clippy` clean on the shipped profile; `cargo audit` no unpatched RCE

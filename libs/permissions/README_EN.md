# VibeChat Permissions

Backend-internal CASL permissions. The active scope normalizes Better Auth users into `admin`/`user` roles and provides the shared authorization decision for every Admin API. Client guards never replace server-side `401`/`403` enforcement.

# Deploy TODO — Oracle Cloud Free Tier

- [ ] Sign up at cloud.oracle.com (card for identity verify only, no charge on Always Free)
- [ ] Generate SSH key if none: `ssh-keygen -t ed25519`
- [ ] Create Compute instance
  - Shape: VM.Standard.A1.Flex (Ampere ARM, Always Free) — 2 OCPU / 12GB is plenty
  - Image: Ubuntu 24.04
  - Attach SSH public key
- [ ] Edit subnet Security List, add Ingress Rules
  - 0.0.0.0/0 TCP 80
  - 0.0.0.0/0 TCP 443
- [ ] Note VM public IP
- [ ] Send IP to Claude to finish setup:
  - install Docker on VM
  - git clone repo
  - fill Caddyfile with `<IP>.sslip.io`
  - create a `.env` file next to `docker-compose.yml` on the VM (copy
    `.env.example` and set a real `JWT_SECRET` — docker compose reads this
    file automatically and interpolates `${JWT_SECRET}` into the api
    container; it is gitignored, so it will NOT exist after `git clone`
    and must be created by hand on every fresh VM)
  - **IMPORTANT — fresh database only:** the auth migration
    (`20260909054550_add_auth`) requires an empty database. It runs
    automatically via `prisma migrate deploy` on container start (see
    Dockerfile) and will crash-loop the api container forever if the
    `api-data` volume already has any JournalEntry/Sighting rows in it from
    a pre-auth deploy. On a brand-new VM this is a non-issue; if you are
    redeploying onto a VM that already ran the app before this branch,
    wipe the `api-data` volume (`docker compose down -v`) or manually
    backfill `userId` before bringing the stack up.
  - `docker compose up -d --build`
  - confirm HTTPS reachable
- [ ] Point Flutter app base URL at `https://<IP>.sslip.io`

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
  - `docker compose up -d --build`
  - confirm HTTPS reachable
- [ ] Point Flutter app base URL at `https://<IP>.sslip.io`

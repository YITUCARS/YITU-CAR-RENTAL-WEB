# YITU Rental on vantu-server-001

The website runs as the isolated `yitu-rental` Compose project in `/opt/yitu-rental`.
It exposes no host port and shares only the external `yitu-edge` network with the
central Nginx container. Production secrets live under
`/yitu-rental/production/app/` in AWS Systems Manager Parameter Store.

The staging origin is `https://aws.yiturentalcars.co.nz`. Keep the Vercel production
domain unchanged until staging health, booking, payment callbacks, admin, staff, and
WeChat flows have been verified.

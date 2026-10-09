# YITU Rental on vantu-server-001

The website runs as the isolated `yitu-rental` Compose project in `/opt/yitu-rental`.
It binds only to `127.0.0.1:3100`, where the shared host Nginx proxies requests.
Production secrets live under
`/yitu-rental/production/app/` in AWS Systems Manager Parameter Store.

Production is served from `https://www.yiturentalcars.co.nz`, with the root domain
redirecting to `www`. The staging origin remains available at
`https://aws.yiturentalcars.co.nz`.

# SSL Certificates for PharmaSpec Validator

## Option 1: Self-Signed Certificate (For Internal VPN Use)

Generate a self-signed certificate for internal company use:

```bash
# Generate self-signed certificate (valid for 1 year)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key \
  -out server.crt \
  -subj "/C=US/ST=State/L=City/O=Company/CN=pharmaspec.local"
```

**Note**: Browsers will show a security warning for self-signed certificates. Users need to accept the certificate exception.

## Option 2: Company CA-Signed Certificate

If your company has an internal Certificate Authority:

1. Generate a Certificate Signing Request (CSR):
```bash
openssl req -new -newkey rsa:2048 -nodes \
  -keyout server.key \
  -out server.csr \
  -subj "/C=US/ST=State/L=City/O=YourCompany/CN=pharmaspec.yourdomain.com"
```

2. Submit `server.csr` to your company's IT department
3. They will sign it and return `server.crt`
4. Place both `server.key` and `server.crt` in this directory

## Option 3: Let's Encrypt (If Server Has Public Domain)

If your server has a public domain name:

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx  # Ubuntu/Debian
# or
yum install certbot python3-certbot-nginx      # RHEL/CentOS

# Generate certificate
certbot --nginx -d yourdomain.com
```

## Enabling HTTPS in nginx

After generating certificates:

1. Ensure `server.crt` and `server.key` are in this directory
2. Edit `nginx/nginx.conf`:
   - Comment out the HTTP-only location blocks
   - Uncomment the HTTPS server block
   - Uncomment the HTTP to HTTPS redirect
3. Restart nginx: `docker-compose -f docker-compose.production.yml restart nginx`

## File Permissions

Ensure correct permissions:
```bash
chmod 600 server.key
chmod 644 server.crt
```

## Security Note

- **Never commit private keys to Git**
- The `server.key` file should be kept secure
- For production, use certificates from a trusted CA

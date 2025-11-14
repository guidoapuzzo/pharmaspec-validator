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

## ⚠️ HTTPS È OBBLIGATORIO

**IMPORTANTE**: La porta 80 (HTTP) è stata disabilitata per motivi di sicurezza. L'applicazione funziona **SOLO con HTTPS**.

### Setup Certificati

Certificati SSL **obbligatori** prima del deploy:

1. Generare certificati con uno dei metodi sopra
2. Assicurarsi che `server.crt` e `server.key` siano in questa directory
3. Verificare che `nginx/nginx.conf` abbia il server block HTTPS attivo (è già configurato)
4. Avviare: `docker-compose -f docker-compose.production.yml up -d`

### ✅ Configurazione Attuale

- ✅ Server block HTTPS (porta 443): **ATTIVO**
- ❌ Server block HTTP (porta 80): **DISABILITATO** (per sicurezza)
- ✅ Security headers: **ABILITATI** (HSTS, CSP, X-Frame-Options, etc.)

Gli utenti devono usare esplicitamente `https://` nell'URL.

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

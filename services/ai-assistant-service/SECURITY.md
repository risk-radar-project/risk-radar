# Security Guidelines for AI Assistant Service

## Environment Variables

This service requires sensitive configuration through environment variables. **Never hardcode API keys or secrets in the source code.**

### Required Environment Variables

- `GOOGLE_API_KEY` - Google Generative AI API key (required for AI analysis)
  - Get your key from: https://makersuite.google.com/app/apikey
  - **CRITICAL**: Never commit this key to version control
  - Always use `.env` file (which is in `.gitignore`)

### Configuration Files

- ✅ **USE**: `.env` file for local development (excluded from git)
- ✅ **USE**: Environment variable injection in production (Kubernetes secrets, Docker secrets, etc.)
- ❌ **NEVER**: Hardcode API keys in `docker-compose.yml`, `main.py`, or any source file
- ❌ **NEVER**: Commit `.env` files to version control

### Example .env file

```env
GOOGLE_API_KEY=your_actual_api_key_here
GOOGLE_AI_MODEL=models/gemini-2.5-flash
```

## Security Best Practices

1. **API Key Protection**
   - Store API keys in environment variables only
   - Use secret management systems in production (AWS Secrets Manager, Azure Key Vault, etc.)
   - Rotate API keys regularly
   - Monitor API usage for anomalies

2. **Docker Security**
   - Use environment variable substitution: `${GOOGLE_API_KEY:-}` (no default fallback)
   - Never include default API keys in docker-compose files
   - Use Docker secrets for production deployments

3. **Code Review**
   - Always review changes to ensure no secrets are being committed
   - Use tools like `git-secrets` or `trufflehog` to scan for accidental commits
   - Run CodeQL security scanning before merging

4. **Dependency Security**
   - Keep dependencies up to date
   - Monitor for security advisories in `google-generativeai` and other packages
   - Use `pip-audit` or similar tools to check for vulnerabilities

## What to Do if a Secret is Exposed

If you accidentally commit an API key or secret:

1. **Immediately revoke the exposed key** in the Google AI console
2. Generate a new API key
3. Update your `.env` file with the new key
4. Use `git filter-branch` or `BFG Repo-Cleaner` to remove the key from git history
5. Force push to overwrite history (coordinate with team)
6. Notify team members to rebase their branches

## Contact

For security concerns, please contact the security team or create a private security advisory.

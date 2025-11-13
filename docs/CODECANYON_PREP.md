# CodeCanyon Packaging

1. Fill `.env.local` locally for testing only (do not commit).
2. Verify SQL in `SQL _CODE/` (will be copied as `sql/` in the package).
3. Run the packaging script:
```
node scripts/prepare-codecanyon.js
```
4. Zip the folder: `dist/codecanyon/sharkszone` and upload to CodeCanyon.

Included:
- source: `src/`, `public/`, configs
- docs: `docs/`
- sql: `sql/`
- README.BUYER.md, changelog.txt, license.txt, .env.example

Excluded automatically: `.env*`, `.next/`, `node_modules/`, `.git/`.

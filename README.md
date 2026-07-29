# Ahmad Shoraka Portfolio

Personal portfolio site + live Angular admin dashboard demo.

## Run locally

```bash
cd C:\Users\hamoodi\ahmadshoraka-portfolio
npm start
```

Open [http://localhost:4200](http://localhost:4200)

Languages: English (`/en`), فارسی (`/fa`), العربية (`/ar`)

- Portfolio home: `/en` (or `/fa`, `/ar`)
- Admin dashboard demo: `/en/demo/admin`
- CV PDF: `/cv/ahmad-shoraka-cv.pdf`

## Deploy to Cloudflare Pages

### Build settings (when connecting GitHub)

| Setting | Value |
|--------|--------|
| Framework preset | None / Angular (or blank) |
| Build command | `npm run build` |
| Build output directory | `dist/ahmadshoraka-portfolio/browser` |
| Node version | `20` or `22` |

SPA routing is handled by `public/_redirects`.

### Recommended path: GitHub → Cloudflare

1. Create a new **public** repo on GitHub named `ahmadshoraka-portfolio`
2. Commit and push this project
3. In [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
4. Select the repo and use the build settings above
5. Deploy → copy the `*.pages.dev` URL

### Alternative: direct upload with Wrangler

```bash
npm install -D wrangler
npx wrangler login
npm run deploy:cf
```

## Add your photo

Save a professional headshot as:

`public/images/profile.jpg`

If missing, the hero shows an `AS` initials fallback.

## Stack

- Angular 22
- Angular Material
- ngx-translate (EN / FA / AR)
- TypeScript + SCSS
- Cloudflare Pages

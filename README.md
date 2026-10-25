# Yes Chef!

Your kitchen assistant. You're the chef, we do the prep.

A web app for busy families: take a quick tour of your kitchen (video, photos or voice), and Yes Chef! keeps track of what's in, tells you what to cook for breakfast, lunch or dinner using what needs eating first, and builds your shopping list.

## Running it

It's a [Next.js](https://nextjs.org) app, designed to be hosted on [Vercel](https://vercel.com).

1. In Vercel, choose **Add New → Project** and import this GitHub repository. The defaults are fine.
2. Under **Settings → Environment Variables**, add `ANTHROPIC_API_KEY` with your key from [console.anthropic.com](https://console.anthropic.com). Then redeploy.
3. Open the web address Vercel gives you on your phone. In Safari, tap **Share → Add to Home Screen**.

Without the API key, the app still opens but can't read photos or suggest meals.

### Shared kitchens (optional)

To let a household share one kitchen across phones, add a database:

1. In the Vercel project, open the **Storage** tab and create an **Upstash Redis** database (the free plan is fine), connected to this project.
2. Redeploy. Then on one phone go to **Menu → Account → Start a shared kitchen** and tap **Invite someone**.

## How it works

- `components/` holds the screens. Everything you log is saved on your phone (browser storage).
- `app/api/scan` sends photos, video stills and your spoken or typed notes to Claude, which returns a tidy stock list.
- `app/api/ideas` asks Claude for a meal idea from your stock, equipment and the time of day.
- `app/api/household` stores a shared kitchen in Upstash Redis, so linked phones see the same stock, kit and shopping list.

## Local development

```
npm install
npm run dev
```

Put your key in a `.env.local` file (see `.env.example`).

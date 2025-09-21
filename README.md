# Welcome to your Lovable project

## Smart Contract

This project FileTimestamp uses a Smart Contract HashTimestamp under the hood to manage the file hashes:

- [HashTimestamp Smart Contract](https://github.com/binqbit/hash-timestamp)

## Project info

**URL**: https://lovable.dev/projects/48cac0b2-dcda-409e-9331-b82254e1d482

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/48cac0b2-dcda-409e-9331-b82254e1d482) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## How do I build and preview the production bundle?

When you need an optimized build for distribution or to share a ready-made bundle, run:

```sh
npm run build
```

To inspect that build locally with working `/hash/<hash>` deep links, serve the `dist` folder in single-page-app mode:

```sh
npx serve -s dist -l 3000
```

The `-s` flag rewrites every request to `index.html`, so the React router can handle routes such as `/hash/dffd6021...` even after a full page refresh. Alternatively, Vite's built-in preview server also applies the correct fallback:

```sh
npm run preview -- --host 0.0.0.0 --port 3000
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/48cac0b2-dcda-409e-9331-b82254e1d482) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

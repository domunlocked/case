# ការគ្រប់គ្រងដីការប៉ុស្តិ៍មេមង

A Khmer-first police case archive built with React/Vite, Express, SQLite, bcrypt, HTTP-only cookie sessions, and Multer image uploads.

## Setup

Requirements: Node.js 18+.

```powershell
npm.cmd run install:all
Copy-Item .env.example .env
npm.cmd run seed --prefix server
```

Put the supplied `police.png` at `client/public/police.png`. The UI has a shield fallback if the asset is absent.

## Run locally

```powershell
npm.cmd run dev --prefix server
npm.cmd run dev --prefix client
```

Open http://localhost:5173. Backend is http://localhost:4000. The six seeded users start with password `123` and must change it on first login.

## Upload testing

After changing the default password, create a test record in each of the four folders. In the image field, select 2-3 real JPG/PNG/WEBP files at once. Confirm that previews appear before saving, all thumbnails appear on the record, clicking a thumbnail opens the viewer, zoom and next/previous work, and deleting the record removes its images from `server/uploads`.

Negative checks: try a non-image file, a file larger than 10 MB, and more than 20 images. Each should show a Khmer validation message and should not create a database image row. Use harmless test photos only; `server/uploads/` and `server/data/` are ignored by Git.

On a phone, open the LAN URL from the same Wi-Fi, choose photos from the camera roll, and repeat the same checks. Keep the computer's backend and frontend terminals running while testing.

## Testing on phones

Connect the phone and computer to the same Wi-Fi, find the computer IPv4 address with `ipconfig`, then open `http://YOUR_COMPUTER_IP:5173` on iPhone Safari or Android Chrome. Set `VITE_API_URL=http://YOUR_COMPUTER_IP:4000` in `client/.env` before starting Vite if the API is not on the same origin.

For internet testing:

```powershell
ngrok http 4000
```

Set `VITE_API_URL` to the HTTPS ngrok backend URL and restart the frontend. For a public frontend, expose port 5173 separately with `ngrok http 5173`.

## Build and GitHub

```powershell
npm.cmd run build
```

Deploy `client/dist` to static hosting. The Render API must use a persistent disk mounted at `/var/data` (the included `render.yaml` configures this) so SQLite, passwords, sessions, case records, and uploaded images survive restarts and redeploys. If configuring Render manually, set `DATA_DIR=/var/data` and `UPLOADS_DIR=/var/data/uploads`; without a persistent disk, hosted data is temporary. Sessions remain valid for 10 years unless the user logs out. រ៉េត ចាន់ឧត្ដម can create users from the dashboard and view the full activity log, while every signed-in user can export case data to PDF for the last 1 month, last 3 months, or a selected month. Keep Express, SQLite, and the data disk on a protected server. Never commit `.env`, `server/data`, or `server/uploads`. To publish source:

```powershell
git init
git add .
git commit -m "Initial Memong police case management app"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPO.git
git push -u origin main
```

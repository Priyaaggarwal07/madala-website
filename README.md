# Mandala Kala — website with a real backend

A working Node.js + Express backend, with a small JSON file as the database
and uploaded photos saved on disk. Everyone who visits the site sees the
same gallery, because it now lives on the server instead of just in one
browser.

## What's inside

```
mandala-backend/
├── server.js          the backend (Express server + API)
├── package.json        the list of packages it needs
├── data/
│   └── paintings.json  your painting data — the "database"
├── uploads/             photos you upload get saved here
├── public/
│   ├── index.html       customer-facing gallery
│   ├── style.css
│   ├── script.js        customer gallery and WhatsApp links
│   ├── admin.html       separate owner dashboard
│   ├── admin.css
│   └── admin.js         owner sign-in and painting management
└── README.md
```

## 1. Install Node.js (only once)

Download and install the **LTS** version from https://nodejs.org if you
don't already have it. To check, open a terminal and run:

```
node -v
```

If that prints a version number, you're set.

## 2. Install the project's packages

Open this folder in a terminal (in VS Code: **Terminal → New Terminal**)
and run:

```
npm install
```

This downloads Express and Multer (the two small libraries the server
uses) into a `node_modules` folder. You only need to do this once, or
again if you move the project somewhere new.

## 3. Start the server

```
npm start
```

You should see:

```
Mandala Kala server running at http://localhost:3000
Admin passcode: mandala123
```

Open **http://localhost:3000** for the public website. The owner dashboard
is separate at **http://localhost:3000/admin**.

To stop the server, go back to the terminal and press `Ctrl + C`.

## How it works

- **Public website**: customers can browse and filter paintings, see
  descriptions and prices, and contact the artist about a piece on WhatsApp.
- **Owner dashboard**: sign in at `/admin` to add paintings, edit details
  or replace photos, search the catalogue, and remove paintings.
- **Backend**: the dashboard uses `POST /api/paintings` to add,
  `PUT /api/paintings/:id` to edit, and `DELETE /api/paintings/:id` to
  remove. The server checks the passcode for every change.
- **Shared gallery**: customer and owner pages use the same
  `GET /api/paintings` data. Uploaded photos are saved in `uploads/`,
  and painting details are saved in `data/paintings.json`.

Because the data lives in `data/paintings.json` and the photos live in
`uploads/`, everything survives restarting the server — it isn't wiped
each time like the browser-only version was.

## Settings to change

Set an `ADMIN_PASSCODE` environment variable before starting the server.
For local development, the fallback passcode is `mandala123`. Do not use
the fallback for a public deployment. The current passcode mechanism is a
simple owner gate, not a full user-account or session authentication system.

Open **`public/script.js`** and edit the top of the file:

```js
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'mandala123';
```

Change the WhatsApp number to yours, and adjust the price ranges if you
want different brackets.

Also update your email and Instagram link directly in
`public/index.html`, in the footer section.

## Putting this online for real customers

Right now this only runs on your own computer (`localhost`). To make it a
real public website, you'd deploy it to a hosting service that runs
Node.js servers, for example:

- **Render** (render.com) — free tier, straightforward for small Node apps
- **Railway** (railway.app)
- **Fly.io**

Before accepting real customer orders, replace the sample WhatsApp number,
email, and Instagram links in `public/index.html`. Set a strong,
private `ADMIN_PASSCODE` in the host's environment settings. For a
production shop, add proper owner accounts/sessions and use durable image
storage such as Cloudinary or AWS S3.

The general steps on any of these are: push this folder to a GitHub
repo, connect that repo to the hosting service, tell it to run
`npm install` then `npm start`, and it gives you a public URL. One thing
to know: most free hosting tiers don't keep uploaded files permanently
across restarts/redeploys, so for a real shop you'd eventually want to
store photos in a service like Cloudinary or AWS S3 instead of the local
`uploads/` folder. Happy to help set that up when you're ready to go
live — just ask.

## If something goes wrong

- **"command not found: node"** → Node.js isn't installed yet, see step 1.
- **"command not found: npm"** → same fix as above.
- **Port already in use** → something else is using port 3000. Run
  `PORT=4000 npm start` instead, then open http://localhost:4000.
- Anything else — copy the exact error text from the terminal and send
  it over, and it can be fixed directly.

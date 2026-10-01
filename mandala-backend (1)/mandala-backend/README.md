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
│   ├── index.html
│   ├── style.css
│   └── script.js       talks to the backend via fetch()
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

Open **http://localhost:3000** in your browser — that's your live site,
gallery and upload form included.

To stop the server, go back to the terminal and press `Ctrl + C`.

## How it works

- **Viewing the gallery**: the page asks the server for the painting list
  (`GET /api/paintings`) and draws the price sections from that.
- **Adding a painting**: the upload form sends the photo and details
  straight to the server (`POST /api/paintings`). The photo is saved in
  `uploads/`, and the details are added to `data/paintings.json`. This
  only works if the passcode is correct — the server checks it, not just
  the browser.
- **Removing a painting**: same idea, `DELETE /api/paintings/:id`, also
  passcode-protected.

Because the data lives in `data/paintings.json` and the photos live in
`uploads/`, everything survives restarting the server — it isn't wiped
each time like the browser-only version was.

## Settings to change

Open **`server.js`** and edit the top of the file:

```js
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'mandala123';
```

Change `'mandala123'` to your own passcode, then restart the server.

Open **`public/script.js`** and edit the top of the file:

```js
const WHATSAPP_NUMBER = "919999999999";
const PRICE_BUCKETS = [ ... ];
```

Change the WhatsApp number to yours, and adjust the price ranges if you
want different brackets.

Also update your email and Instagram link directly in
`public/index.html`, in the footer section.

## Putting this online for real customers

This project is ready to deploy to a real public host. The easiest option
is **Render** because it supports a simple Node.js web app and gives you a
public HTTPS URL automatically.

### Deploy on Render

1. Push this folder to GitHub.
2. Open https://render.com and create a new **Web Service**.
3. Connect your GitHub repo.
4. Use these settings:
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment variables:
     - `PORT=10000`
     - `HOST=0.0.0.0`
     - `ADMIN_PASSCODE=mandala123`
5. Click **Deploy**.
6. Render gives you a public HTTPS URL like:
   `https://your-project-name.onrender.com`

### Admin URL after deployment

- Public site: `https://your-project-name.onrender.com`
- Admin page: `https://your-project-name.onrender.com/admin`

One thing to know: most free hosting tiers do not keep uploaded files
permanently across restarts or redeploys, so for a real shop you'd
eventually want to store photos in a service like Cloudinary or AWS S3
instead of the local `uploads/` folder.

## If something goes wrong

- **"command not found: node"** → Node.js isn't installed yet, see step 1.
- **"command not found: npm"** → same fix as above.
- **Port already in use** → something else is using port 3000. Run
  `PORT=4000 npm start` instead, then open http://localhost:4000.
- Anything else — copy the exact error text from the terminal and send
  it over, and it can be fixed directly.

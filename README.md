# CareSphere Server API - Social Development Events Platform

> **Live Server API URL:** [https://caresphere-server.vercel.app](https://caresphere-server.vercel.app)
> **Live Client Application:** [https://caresphere-client.vercel.app](https://caresphere-client.vercel.app)

Backend REST API for CareSphere, handling user authentication, MongoDB persistence, JWT authorization, and community event CRUD operations.

---

## 🛠️ Technology Stack
- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js
- **Database:** MongoDB Native Driver
- **Authentication:** JWT (JSON Web Tokens) & BcryptJS
- **CORS & Environment:** cors, dotenv, cookie-parser

---

## 🔑 Environment Variables
Create a `.env` file in the root of the `server` directory:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/caresphere?retryWrites=true&w=majority
JWT_SECRET=caresphere_super_secret_jwt_key_2026_social_dev
CLIENT_URL=http://localhost:3000
```

---

## 📡 API Endpoints

### 🔐 Authentication (`/api/auth`)
- `POST /api/auth/register` - Create new volunteer account (validated password: uppercase, lowercase, 6+ chars)
- `POST /api/auth/login` - Authenticate with email and password
- `POST /api/auth/google` - Social Google authentication
- `GET /api/auth/me` - Retrieve current logged-in profile (JWT protected)
- `PUT /api/auth/profile` - Update display name and photo URL (JWT protected)

### 📅 Events (`/api/events`)
- `GET /api/events/upcoming` - Get upcoming future events (supports `?limit=6`, `?search=...`, `?type=...`)
- `GET /api/events/:id` - Get event details + attendees list (public)
- `POST /api/events` - Create an event with strict future date validation (JWT protected)
- `PUT /api/events/:id` - Update creator's own event (JWT protected)
- `DELETE /api/events/:id` - Delete creator's own event (JWT protected)
- `GET /api/events/manage` - List all events created by logged-in user (JWT protected)
- `POST /api/events/:id/join` - Join an event as volunteer (JWT protected)
- `DELETE /api/events/:id/leave` - Cancel volunteer RSVP (JWT protected)
- `GET /api/events/joined` - List events joined by user, sorted by date (JWT protected)

### 🧪 Database Seeder
- `POST /api/seed` - Reseed database with realistic initial community initiatives

---

## 🚀 Running the Server Locally
```bash
# Install dependencies
npm install

# Start in development mode (nodemon)
npm run dev

# Start in production mode
npm start
```
Server runs on [http://localhost:5000](http://localhost:5000).

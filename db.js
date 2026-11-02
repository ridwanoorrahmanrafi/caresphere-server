import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
import dns from "node:dns";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config();

// Fix for Windows ISP DNS blocking MongoDB SRV queries (only on Windows, not in Linux/Vercel)
if (process.platform === "win32") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {
    // Ignore if not permitted
  }
}

let client = null;
let db = null;
let isConnected = false;

export async function connectDB() {
  if (db && isConnected) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is missing!");
  }

  try {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    await client.connect();
    db = client.db("caresphere");
    isConnected = true;
    console.log("✅ Connected successfully to MongoDB Atlas database 'caresphere'!");

    // Ensure collections and indexes exist
    try {
      const eventsCollection = db.collection("events");
      await eventsCollection.createIndex({ eventDate: 1 });
      const joinedCollection = db.collection("joined_events");
      await joinedCollection.createIndex({ eventId: 1, userEmail: 1 });
      const usersCollection = db.collection("users");
      await usersCollection.createIndex({ email: 1 });
    } catch (idxErr) {
      console.warn("MongoDB Index note:", idxErr.message);
    }

    return db;
  } catch (error) {
    console.error("❌ MongoDB Atlas connection error:", error.message);
    isConnected = false;
    throw error;
  }
}

export function getDB() {
  if (!db) {
    throw new Error("Database not connected. Please call connectDB() first.");
  }
  return db;
}

export function isDbConnected() {
  return isConnected;
}

export function getCollection(name) {
  if (!db || !isConnected) {
    throw new Error(`Database connection not established. Cannot access MongoDB collection '${name}'.`);
  }
  return db.collection(name);
}

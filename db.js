import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/caresphere";

let client = null;
let db = null;
let isConnected = false;

// In-memory fallback storage in case MongoDB server is initializing
const memoryStore = {
  events: [],
  joined_events: [],
  users: [],
};

export async function connectDB() {
  if (db && isConnected) return db;
  try {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000, // 5s timeout instead of 30s
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    await client.connect();
    db = client.db("caresphere");
    isConnected = true;
    console.log("✅ Connected successfully to MongoDB!");

    // Create indexes safely
    try {
      const eventsCollection = db.collection("events");
      await eventsCollection.createIndex({ eventDate: 1 });
      const joinedCollection = db.collection("joined_events");
      await joinedCollection.createIndex({ eventId: 1, userEmail: 1 });
      const usersCollection = db.collection("users");
      await usersCollection.createIndex({ email: 1 });
    } catch (idxErr) {
      console.warn("Index creation note:", idxErr.message);
    }

    return db;
  } catch (error) {
    console.warn("⚠️ MongoDB connection failed. Will retry when connection string is provided:", error.message);
    isConnected = false;
    return null;
  }
}

export function getDB() {
  return db;
}

export function isDbConnected() {
  return isConnected;
}

export function getCollection(name) {
  if (db && isConnected) {
    return db.collection(name);
  }

  // Graceful memory collection fallback with standard MongoDB-like query interface
  return {
    async countDocuments() {
      return (memoryStore[name] || []).length;
    },
    async insertMany(items) {
      const enriched = items.map((it, idx) => ({
        _id: it._id || `mem_${Date.now()}_${idx}`,
        ...it,
      }));
      memoryStore[name] = [...(memoryStore[name] || []), ...enriched];
      return { insertedCount: items.length };
    },
    async insertOne(item) {
      const id = item._id || `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const doc = { ...item, _id: id };
      memoryStore[name] = memoryStore[name] || [];
      memoryStore[name].push(doc);
      return { insertedId: id };
    },
    async findOne(query) {
      const list = memoryStore[name] || [];
      return (
        list.find((it) => {
          for (const [key, val] of Object.entries(query)) {
            if (key === "_id") {
              if (it._id?.toString() !== val?.toString()) return false;
            } else if (it[key] !== val) {
              return false;
            }
          }
          return true;
        }) || null
      );
    },
    find(query = {}) {
      let list = [...(memoryStore[name] || [])];
      if (query.creatorEmail) {
        list = list.filter((it) => it.creatorEmail === query.creatorEmail);
      }
      if (query.userEmail) {
        list = list.filter((it) => it.userEmail === query.userEmail);
      }
      if (query.eventType && query.eventType !== "All") {
        list = list.filter((it) => it.eventType === query.eventType);
      }

      return {
        sort() {
          return this;
        },
        limit(num) {
          list = list.slice(0, num);
          return this;
        },
        async toArray() {
          return list;
        },
        project() {
          return this;
        },
      };
    },
    async updateOne(query, update) {
      const list = memoryStore[name] || [];
      const item = list.find((it) => {
        if (query._id) return it._id?.toString() === query._id?.toString();
        if (query.email) return it.email === query.email;
        return false;
      });
      if (item && update.$set) {
        Object.assign(item, update.$set);
        return { modifiedCount: 1 };
      }
      return { modifiedCount: 0 };
    },
    async updateMany(query, update) {
      const list = memoryStore[name] || [];
      let count = 0;
      list.forEach((it) => {
        if (query.eventId && it.eventId === query.eventId) {
          if (update.$set) Object.assign(it, update.$set);
          count++;
        }
        if (query.userEmail && it.userEmail === query.userEmail) {
          if (update.$set) Object.assign(it, update.$set);
          count++;
        }
      });
      return { modifiedCount: count };
    },
    async deleteOne(query) {
      const list = memoryStore[name] || [];
      const initialLen = list.length;
      memoryStore[name] = list.filter((it) => {
        if (query._id) return it._id?.toString() !== query._id?.toString();
        if (query.eventId && query.userEmail) {
          return !(it.eventId === query.eventId && it.userEmail === query.userEmail);
        }
        return true;
      });
      return { deletedCount: initialLen - memoryStore[name].length };
    },
    async deleteMany(query = {}) {
      if (Object.keys(query).length === 0) {
        memoryStore[name] = [];
        return { deletedCount: 0 };
      }
      const list = memoryStore[name] || [];
      const initialLen = list.length;
      memoryStore[name] = list.filter((it) => {
        if (query.eventId) return it.eventId !== query.eventId;
        return true;
      });
      return { deletedCount: initialLen - memoryStore[name].length };
    },
  };
}

export { client };

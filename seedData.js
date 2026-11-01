import { getCollection } from "./db.js";

// Generates dynamic future dates starting from tomorrow
function getFutureDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0]; // "YYYY-MM-DD"
}

export const initialEvents = [
  {
    title: "Winter Clothes Distribution – Mirpur 10, Dhaka",
    description: "Join us in bringing warmth to underprivileged families and children living in Mirpur 10 slum clusters. We will distribute heavy jackets, woolen shawls, thermal blankets, and baby warmers before the intense winter waves begin.",
    eventType: "Donation Drive",
    thumbnail: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80",
    location: "Mirpur 10 Roundabout, Dhaka",
    eventDate: getFutureDate(5),
    eventDateIso: new Date(getFutureDate(5)).toISOString(),
    creatorEmail: "community@caresphere.org",
    creatorName: "CareSphere Community Team",
    creatorPhoto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
    createdAt: new Date(),
  },
  {
    title: "Blanket Distribution for the Needy – Mohammadpur, Dhaka",
    description: "A community-led night distribution initiative for elderly homeless individuals and rickshaw pullers around Town Hall and Mohammadpur Bus Stand. Volunteers will package blankets and distribute them directly with care.",
    eventType: "Donation Drive",
    thumbnail: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80",
    location: "Mohammadpur Town Hall, Dhaka",
    eventDate: getFutureDate(8),
    eventDateIso: new Date(getFutureDate(8)).toISOString(),
    creatorEmail: "community@caresphere.org",
    creatorName: "CareSphere Community Team",
    creatorPhoto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
    createdAt: new Date(),
  },
  {
    title: "Dhanmondi Lake Mega Clean-Up & Plastic Free Drive",
    description: "Empowering our city youth to restore Dhanmondi Lake walkway and shoreline ecosystems. Gloves, trash grabbers, eco-friendly disposal bags, and refreshments will be provided to all volunteers.",
    eventType: "Clean-up",
    thumbnail: "https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=800&q=80",
    location: "Rabindra Sarobar, Dhanmondi 8/A, Dhaka",
    eventDate: getFutureDate(12),
    eventDateIso: new Date(getFutureDate(12)).toISOString(),
    creatorEmail: "greenearth@caresphere.org",
    creatorName: "Eco Action Bangladesh",
    creatorPhoto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80",
    createdAt: new Date(),
  },
  {
    title: "Green Future Tree Plantation – Diabari, Uttara",
    description: "Planting 1,000 native neem, mahogany, and fruit-bearing saplings along the Diabari metro extension avenue to combat urban heat islands and enhance city biodiversity.",
    eventType: "Plantation",
    thumbnail: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80",
    location: "Sector 18, Diabari, Uttara, Dhaka",
    eventDate: getFutureDate(15),
    eventDateIso: new Date(getFutureDate(15)).toISOString(),
    creatorEmail: "greenearth@caresphere.org",
    creatorName: "Eco Action Bangladesh",
    creatorPhoto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80",
    createdAt: new Date(),
  },
  {
    title: "Free Medical & Eye Checkup Camp for Elderly",
    description: "Licensed volunteer doctors, pharmacists, and optometrists will provide free blood sugar screening, blood pressure monitoring, eye exams, and free prescription glasses for elderly day-laborers.",
    eventType: "Healthcare",
    thumbnail: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=800&q=80",
    location: "Community Center, Lalbagh, Old Dhaka",
    eventDate: getFutureDate(19),
    eventDateIso: new Date(getFutureDate(19)).toISOString(),
    creatorEmail: "healthcare@caresphere.org",
    creatorName: "Hope Medical Volunteers",
    creatorPhoto: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80",
    createdAt: new Date(),
  },
  {
    title: "Books & School Stationery Distribution for Slum Children",
    description: "Supporting 350 underprivileged students with backpacks, notebooks, geometry boxes, storybooks, and art supplies to keep children inspired and enrolled in school.",
    eventType: "Education",
    thumbnail: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80",
    location: "Korail Bastee Community Field, Mohakhali, Dhaka",
    eventDate: getFutureDate(22),
    eventDateIso: new Date(getFutureDate(22)).toISOString(),
    creatorEmail: "education@caresphere.org",
    creatorName: "Shikha Foundation",
    creatorPhoto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
    createdAt: new Date(),
  },
];

export async function seedDatabaseIfEmpty() {
  try {
    const eventsCollection = getCollection("events");
    const count = await eventsCollection.countDocuments();
    if (count === 0) {
      console.log("🌱 Database is empty. Seeding initial social development events...");
      await eventsCollection.insertMany(initialEvents);
      console.log(`✅ Seeded ${initialEvents.length} initial events successfully.`);
    }
  } catch (error) {
    console.error("⚠️ Error while auto-seeding database:", error.message);
  }
}

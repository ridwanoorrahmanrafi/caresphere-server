import express from "express";
import { ObjectId } from "mongodb";
import { getCollection } from "../db.js";
import { verifyAuth, optionalAuth } from "../middleware/auth.js";

const router = express.Router();

// Helper to check if a date string is in the future
function isFutureDate(dateStr) {
  if (!dateStr) return false;
  const eventTime = new Date(dateStr).getTime();
  const now = new Date().getTime();
  // Allow minimum buffer of 1 minute ahead
  return !isNaN(eventTime) && eventTime > now;
}

// 1. GET /api/events/upcoming - Public
// Returns all upcoming events (dates in the future).
// Supports ?limit=6 (Home page uses MongoDB .limit(6)), ?search=..., ?type=...
router.get("/upcoming", async (req, res) => {
  try {
    const { limit, search, type } = req.query;
    const eventsCollection = getCollection("events");

    const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const nowIso = new Date().toISOString();

    // Query filter for future events only
    const query = {
      $or: [
        { eventDate: { $gte: todayStr } },
        { eventDateIso: { $gte: nowIso } },
      ],
    };

    // Category / Event Type filter
    if (type && type !== "All") {
      query.eventType = type;
    }

    // Search filter across title and location
    if (search && search.trim().length > 0) {
      const regex = new RegExp(search.trim(), "i");
      query.$and = [
        {
          $or: [{ title: regex }, { location: regex }, { description: regex }],
        },
      ];
    }

    // Sort upcoming events by date ascending (nearest events first)
    let cursor = eventsCollection.find(query).sort({ eventDate: 1, createdAt: -1 });

    // Enforce MongoDB .limit() when requested (e.g., Home page requests limit=6)
    if (limit && !isNaN(Number(limit))) {
      cursor = cursor.limit(Number(limit));
    }

    const events = await cursor.toArray();

    return res.status(200).json({
      success: true,
      count: events.length,
      events: events.map((e) => ({
        ...e,
        _id: e._id.toString(),
      })),
    });
  } catch (error) {
    console.error("Fetch upcoming events error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve upcoming events: " + error.message,
    });
  }
});

// 2. GET /api/events/manage - Private
// Returns all events created by the logged-in user
router.get("/manage", verifyAuth, async (req, res) => {
  try {
    const eventsCollection = getCollection("events");
    const userEmail = req.user.email;

    const events = await eventsCollection
      .find({ creatorEmail: userEmail })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: events.length,
      events: events.map((e) => ({
        ...e,
        _id: e._id.toString(),
      })),
    });
  } catch (error) {
    console.error("Fetch managed events error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve your managed events.",
    });
  }
});

// 3. GET /api/events/joined - Private
// Returns all events joined by current user, sorted by event date
router.get("/joined", verifyAuth, async (req, res) => {
  try {
    const joinedCollection = getCollection("joined_events");
    const userEmail = req.user.email;

    // Requirement: "Show events sorted by event date."
    const joinedRecords = await joinedCollection
      .find({ userEmail })
      .sort({ eventDate: 1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: joinedRecords.length,
      joinedEvents: joinedRecords.map((r) => ({
        ...r,
        _id: r._id.toString(),
      })),
    });
  } catch (error) {
    console.error("Fetch joined events error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve joined events.",
    });
  }
});

// 4. GET /api/events/:id - Public
// View single event details + participants
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format.",
      });
    }

    const eventsCollection = getCollection("events");
    const event = await eventsCollection.findOne({ _id: new ObjectId(id) });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    // Get attendee count and list
    const joinedCollection = getCollection("joined_events");
    const attendees = await joinedCollection
      .find({ eventId: id })
      .project({ userName: 1, userEmail: 1, userPhoto: 1, joinedAt: 1 })
      .toArray();

    // Check if the current requesting user has already joined
    let isUserJoined = false;
    if (req.user && req.user.email) {
      const existingJoin = await joinedCollection.findOne({
        eventId: id,
        userEmail: req.user.email,
      });
      isUserJoined = !!existingJoin;
    }

    return res.status(200).json({
      success: true,
      event: {
        ...event,
        _id: event._id.toString(),
        attendeesCount: attendees.length,
        attendees,
      },
      attendeesCount: attendees.length,
      attendees,
      isUserJoined,
    });
  } catch (error) {
    console.error("Fetch event details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve event details.",
    });
  }
});

// 5. POST /api/events - Private
// Create a new event.
// Validation: Title, description, eventType, thumbnail, location, eventDate must be in future!
router.post("/", verifyAuth, async (req, res) => {
  try {
    const { title, description, eventType, thumbnail, location, eventDate } = req.body;

    // Field presence validation
    if (!title || !description || !eventType || !thumbnail || !location || !eventDate) {
      return res.status(400).json({
        success: false,
        message: "All fields are required (Title, Description, Event Type, Thumbnail, Location, Event Date).",
      });
    }

    // Strict Future Date validation: Past dates cannot be added!
    if (!isFutureDate(eventDate)) {
      return res.status(400).json({
        success: false,
        message: "Event date must be in the future. Past dates are not allowed.",
      });
    }

    const eventsCollection = getCollection("events");

    const newEvent = {
      title: title.trim(),
      description: description.trim(),
      eventType: eventType.trim(),
      thumbnail: thumbnail.trim(),
      location: location.trim(),
      eventDate: eventDate.trim(), // e.g., "2026-11-15" or "2026-11-15T10:00"
      eventDateIso: new Date(eventDate).toISOString(),
      creatorEmail: req.user.email,
      creatorName: req.user.name || "Organizer",
      creatorPhoto: req.user.photoURL || "",
      createdAt: new Date(),
    };

    const result = await eventsCollection.insertOne(newEvent);

    return res.status(201).json({
      success: true,
      message: "Social service event created successfully!",
      event: {
        ...newEvent,
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error("Create event error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create event. Internal server error.",
    });
  }
});

// 6. PUT /api/events/:id - Private
// Update event. Users can only update their own events.
router.put("/:id", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format.",
      });
    }

    const { title, description, eventType, thumbnail, location, eventDate } = req.body;

    if (!title || !description || !eventType || !thumbnail || !location || !eventDate) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    // Strict Future Date validation
    if (!isFutureDate(eventDate)) {
      return res.status(400).json({
        success: false,
        message: "Event date must be in the future. Past dates are not allowed.",
      });
    }

    const eventsCollection = getCollection("events");
    const existingEvent = await eventsCollection.findOne({ _id: new ObjectId(id) });

    if (!existingEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    // Security check: Only creator can update
    if (existingEvent.creatorEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden: You can only update events that you created.",
      });
    }

    const updateDoc = {
      $set: {
        title: title.trim(),
        description: description.trim(),
        eventType: eventType.trim(),
        thumbnail: thumbnail.trim(),
        location: location.trim(),
        eventDate: eventDate.trim(),
        eventDateIso: new Date(eventDate).toISOString(),
        updatedAt: new Date(),
      },
    };

    await eventsCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);

    // Sync updated info into joined_events collection
    const joinedCollection = getCollection("joined_events");
    await joinedCollection.updateMany(
      { eventId: id },
      {
        $set: {
          eventTitle: title.trim(),
          eventDate: eventDate.trim(),
          eventLocation: location.trim(),
          eventType: eventType.trim(),
          thumbnail: thumbnail.trim(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Event updated successfully!",
    });
  } catch (error) {
    console.error("Update event error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update event.",
    });
  }
});

// 7. DELETE /api/events/:id - Private
// Delete event. Users can only delete their own events.
router.delete("/:id", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format.",
      });
    }

    const eventsCollection = getCollection("events");
    const existingEvent = await eventsCollection.findOne({ _id: new ObjectId(id) });

    if (!existingEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    // Security check: Only creator can delete
    if (existingEvent.creatorEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden: You can only delete events that you created.",
      });
    }

    // Delete event
    await eventsCollection.deleteOne({ _id: new ObjectId(id) });

    // Remove all join records for this deleted event
    const joinedCollection = getCollection("joined_events");
    await joinedCollection.deleteMany({ eventId: id });

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully!",
    });
  } catch (error) {
    console.error("Delete event error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete event.",
    });
  }
});

// 8. POST /api/events/:id/join - Private
// Join an event. Must be logged in. Stores user & event data in DB.
router.post("/:id/join", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format.",
      });
    }

    const eventsCollection = getCollection("events");
    const event = await eventsCollection.findOne({ _id: new ObjectId(id) });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    const joinedCollection = getCollection("joined_events");

    // Check if user already joined
    const alreadyJoined = await joinedCollection.findOne({
      eventId: id,
      userEmail: req.user.email,
    });

    if (alreadyJoined) {
      return res.status(400).json({
        success: false,
        message: "You have already joined this event!",
      });
    }

    const joinRecord = {
      eventId: id,
      eventTitle: event.title,
      eventDate: event.eventDate,
      eventLocation: event.location,
      eventType: event.eventType,
      thumbnail: event.thumbnail,
      userEmail: req.user.email,
      userName: req.user.name || "Volunteer",
      userPhoto: req.user.photoURL || "",
      joinedAt: new Date(),
    };

    await joinedCollection.insertOne(joinRecord);
    const updatedCount = await joinedCollection.countDocuments({ eventId: id });

    return res.status(201).json({
      success: true,
      message: "Awesome! You have successfully joined this event as a volunteer.",
      attendeesCount: updatedCount,
      attendee: {
        userName: joinRecord.userName,
        userEmail: joinRecord.userEmail,
        userPhoto: joinRecord.userPhoto,
        joinedAt: joinRecord.joinedAt,
      },
      joinRecord: {
        ...joinRecord,
        _id: joinRecord._id.toString(),
      },
    });
  } catch (error) {
    console.error("Join event error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to join event.",
    });
  }
});

// 9. DELETE /api/events/:id/leave - Private
// Cancel RSVP / leave event
router.delete("/:id/leave", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const joinedCollection = getCollection("joined_events");

    const result = await joinedCollection.deleteOne({
      eventId: id,
      userEmail: req.user.email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "You have not joined this event.",
      });
    }

    const updatedCount = await joinedCollection.countDocuments({ eventId: id });

    return res.status(200).json({
      success: true,
      message: "You have successfully canceled your RSVP for this event.",
      attendeesCount: updatedCount,
    });
  } catch (error) {
    console.error("Leave event error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to leave event.",
    });
  }
});

export default router;

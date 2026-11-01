import express from "express";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getCollection } from "../db.js";
import { generateToken, verifyAuth } from "../middleware/auth.js";

const router = express.Router();

// Password validator helper according to requirements:
// uppercase letter, lowercase letter, at least 6 characters
function validatePassword(password) {
  if (!password || typeof password !== "string") return false;
  if (password.length < 6) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  return hasUpper && hasLower;
}

// 1. Register Route
router.post("/register", async (req, res) => {
  try {
    const { name, email, photoURL, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    // Password validation rule
    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, and be at least 6 characters long.",
      });
    }

    const usersCollection = getCollection("users");
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email address already exists.",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      name: name.trim(),
      email: normalizedEmail,
      photoURL: photoURL?.trim() || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80",
      password: hashedPassword,
      createdAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    const safeUser = {
      id: result.insertedId.toString(),
      name: newUser.name,
      email: newUser.email,
      photoURL: newUser.photoURL,
    };

    const token = generateToken(safeUser);

    return res.status(201).json({
      success: true,
      message: "Account registered successfully!",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Registration failed. Internal server error.",
    });
  }
});

// 2. Login Route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const usersCollection = getCollection("users");
    const normalizedEmail = email.toLowerCase().trim();

    const user = await usersCollection.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const safeUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      photoURL: user.photoURL,
    };

    const token = generateToken(safeUser);

    return res.status(200).json({
      success: true,
      message: "Logged in successfully!",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed. Internal server error.",
    });
  }
});

// 3. Social / Google Login (Federated Auth)
router.post("/google", async (req, res) => {
  try {
    const { name, email, photoURL } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required for Google login.",
      });
    }

    const usersCollection = getCollection("users");
    const normalizedEmail = email.toLowerCase().trim();

    let user = await usersCollection.findOne({ email: normalizedEmail });

    if (!user) {
      // Create user from Google profile
      const newUser = {
        name: name || "Volunteer",
        email: normalizedEmail,
        photoURL: photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80",
        provider: "google",
        createdAt: new Date(),
      };
      const result = await usersCollection.insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    } else if (photoURL && !user.photoURL) {
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { photoURL } }
      );
      user.photoURL = photoURL;
    }

    const safeUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      photoURL: user.photoURL,
    };

    const token = generateToken(safeUser);

    return res.status(200).json({
      success: true,
      message: "Google login successful!",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Google login error:", error);
    return res.status(500).json({
      success: false,
      message: "Google authentication failed.",
    });
  }
});

// 4. Current User Session Check
router.get("/me", verifyAuth, async (req, res) => {
  try {
    const usersCollection = getCollection("users");
    const user = await usersCollection.findOne(
      { email: req.user.email },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        photoURL: user.photoURL,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user profile.",
    });
  }
});

// 5. Update Profile (Optional Requirement 2: Profile view & update profile)
router.put("/profile", verifyAuth, async (req, res) => {
  try {
    const { name, photoURL } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Display name cannot be empty.",
      });
    }

    const usersCollection = getCollection("users");
    const updateFields = {
      name: name.trim(),
    };

    if (photoURL && photoURL.trim().length > 0) {
      updateFields.photoURL = photoURL.trim();
    }

    await usersCollection.updateOne(
      { email: req.user.email },
      { $set: updateFields }
    );

    // Update in joined events as well so attendee avatars update
    const joinedCollection = getCollection("joined_events");
    await joinedCollection.updateMany(
      { userEmail: req.user.email },
      { $set: { userName: updateFields.name, userPhoto: updateFields.photoURL || req.user.photoURL } }
    );

    const updatedUser = {
      id: req.user.id,
      name: updateFields.name,
      email: req.user.email,
      photoURL: updateFields.photoURL || req.user.photoURL,
    };

    const newToken = generateToken(updatedUser);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully!",
      token: newToken,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile.",
    });
  }
});

export default router;

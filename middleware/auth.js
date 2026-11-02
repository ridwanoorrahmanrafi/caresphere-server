import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "caresphere_super_secret_jwt_key_2026_social_dev";

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAuth(req, res, next) {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Authentication token is missing.",
      });
    }

    // 1. First attempt: Verify signature with JWT_SECRET
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded; // { id, email, name, photoURL }
      return next();
    } catch (jwtErr) {
      // 2. Second attempt: Check if it's a valid Firebase / Google OAuth token
      const decoded = jwt.decode(token);
      if (
        decoded &&
        decoded.email &&
        (decoded.iss?.includes("securetoken.google.com") ||
          decoded.aud?.includes("assignment-8") ||
          decoded.firebase ||
          decoded.sub)
      ) {
        req.user = {
          id: decoded.sub || decoded.user_id || "google_user",
          email: decoded.email,
          name: decoded.name || decoded.displayName || "Volunteer",
          photoURL: decoded.picture || decoded.photoURL || "",
        };
        return next();
      }
      throw jwtErr;
    }
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token. Please log in again.",
    });
  }
}

// Optional auth helper: attaches user if token exists, but doesn't block request if absent
export function optionalAuth(req, res, next) {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
      } catch {
        const decoded = jwt.decode(token);
        if (decoded && decoded.email) {
          req.user = {
            id: decoded.sub || decoded.user_id || "google_user",
            email: decoded.email,
            name: decoded.name || decoded.displayName || "Volunteer",
            photoURL: decoded.picture || decoded.photoURL || "",
          };
        }
      }
    }
  } catch {
    // Ignore invalid token for optional auth
  }
  next();
}

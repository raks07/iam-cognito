const express = require("express");
const session = require("express-session");
const { Issuer, generators } = require("openid-client");
const debug = require("debug")("app:main");
require("dotenv").config();

// Unhandled errors and promise rejection logging
process.on("uncaughtException", (err) => {
  debug("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  debug("UNHANDLED REJECTION! 💥 Shutting down...");
  console.error("UNHANDLED REJECTION! 💥 Shutting down...");
  console.error(err.name, err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 3000;

let client;

// Initialize OpenID Client
async function initializeClient() {
  try {
    debug("Initializing OpenID Client...");
    // Cognito OIDC discovery endpoint
    const issuerUrl = `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`;
    debug("Discovery URL: %s", issuerUrl);

    const issuer = await Issuer.discover(issuerUrl);
    debug("Issuer discovered: %s %s", issuer.issuer, issuer.metadata.jwks_uri);

    client = new issuer.Client({
      client_id: process.env.COGNITO_CLIENT_ID,
      client_secret: process.env.COGNITO_CLIENT_SECRET,
      redirect_uris: [process.env.CALLBACK_URL],
      response_types: ["code"],
    });

    debug("Environment variables check:");
    debug("- COGNITO_CLIENT_ID: %s", process.env.COGNITO_CLIENT_ID ? "Set" : "Not set");
    debug("- COGNITO_CLIENT_SECRET: %s", process.env.COGNITO_CLIENT_SECRET ? "Set" : "Not set");
    debug("- CALLBACK_URL: %s", process.env.CALLBACK_URL);
    debug("- COGNITO_DOMAIN: %s", process.env.COGNITO_DOMAIN);
    debug("- LOGOUT_URI: %s", process.env.LOGOUT_URI);

    console.log("OpenID Client initialized successfully");
    debug("OpenID Client initialized successfully");
  } catch (error) {
    debug("Failed to initialize OpenID Client: %O", error);
    console.error("Failed to initialize OpenID Client:", error);
  }
}

// Configure view engine
app.set("view engine", "ejs");

// Configure session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret-change-this",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Authentication middleware
const checkAuth = (req, res, next) => {
  try {
    debug("Checking authentication for request %s %s", req.method, req.path);
    if (!req.session.userInfo) {
      req.isAuthenticated = false;
      debug("User is not authenticated");
    } else {
      req.isAuthenticated = true;
      debug("User is authenticated: %s", req.session.userInfo.email || req.session.userInfo.sub);
    }
    next();
  } catch (error) {
    debug("Authentication check error: %O", error);
    console.error("Authentication check error:", error);
    req.isAuthenticated = false;
    next();
  }
};

// Helper function to get path from URL
function getPathFromURL(urlString) {
  try {
    const url = new URL(urlString);
    return url.pathname;
  } catch (error) {
    debug("Invalid URL: %s", urlString);
    console.error("Invalid URL:", error);
    return null;
  }
}

// Routes
// Home route
app.get("/", checkAuth, (req, res) => {
  try {
    debug("Handling request for home route");
    res.render("home", {
      isAuthenticated: req.isAuthenticated,
      userInfo: req.session.userInfo,
    });
    debug("Home page rendered successfully");
  } catch (error) {
    debug("Home route error: %O", error);
    console.error("Home route error:", error);
    res.status(500).send("Error loading home page");
  }
});

// Login route
app.get("/login", (req, res) => {
  try {
    debug("Handling request for login route");
    if (!client) {
      debug("Authentication client not available");
      return res.status(500).send("Authentication service not available");
    }

    const nonce = generators.nonce();
    const state = generators.state();
    debug("Generated auth nonce and state");

    req.session.nonce = nonce;
    req.session.state = state;

    const authUrl = client.authorizationUrl({
      scope: "phone openid email profile",
      state: state,
      nonce: nonce,
    });
    debug("Generated authorization URL: %s", authUrl);

    res.redirect(authUrl);
  } catch (error) {
    debug("Login route error: %O", error);
    console.error("Login route error:", error);
    res.status(500).send("Error during login process");
  }
});

// Callback route
app.get("/callback", async (req, res) => {
  try {
    debug("Handling request for callback route");
    if (!client) {
      debug("Authentication client not available");
      return res.status(500).send("Authentication service not available");
    }

    debug("Parsing callback parameters");
    const params = client.callbackParams(req);
    debug("Callback parameters: %O", params);

    debug("Verifying and exchanging code for tokens");
    const tokenSet = await client.callback(process.env.CALLBACK_URL, params, {
      nonce: req.session.nonce,
      state: req.session.state,
    });
    debug("Token set received: %O", {
      access_token: tokenSet.access_token ? "(set)" : "(not set)",
      id_token: tokenSet.id_token ? "(set)" : "(not set)",
      refresh_token: tokenSet.refresh_token ? "(set)" : "(not set)",
    });

    debug("Fetching user info");
    const userInfo = await client.userinfo(tokenSet.access_token);
    debug("User info received: %O", {
      sub: userInfo.sub,
      email: userInfo.email,
    });

    req.session.userInfo = userInfo;

    // Clear temporary session data
    delete req.session.nonce;
    delete req.session.state;
    debug("Temporary session data cleared");

    debug("Redirecting to home page");
    res.redirect("/");
  } catch (error) {
    debug("Callback error: %O", error);
    console.error("Callback error:", error);
    res.redirect("/?error=auth_failed");
  }
});

// Logout route
app.get("/logout", (req, res) => {
  try {
    debug("Handling request for logout route");
    req.session.destroy((err) => {
      if (err) {
        debug("Session destruction error: %O", err);
        console.error("Session destruction error:", err);
      }

      // Cognito logout URL
      const logoutUrl = `https://${process.env.COGNITO_DOMAIN}/logout?client_id=${process.env.COGNITO_CLIENT_ID}&logout_uri=${process.env.LOGOUT_URI}`;
      debug("Redirecting to logout URL: %s", logoutUrl);
      res.redirect(logoutUrl);
    });
  } catch (error) {
    debug("Logout error: %O", error);
    console.error("Logout error:", error);
    res.status(500).send("Error during logout process");
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  debug("Global error handler triggered: %O", err);
  console.error("Global error handler:", err.stack);
  res.status(500).send("Something went wrong!");
});

// 404 handler
app.use((req, res) => {
  try {
    debug("404 handler: %s %s not found", req.method, req.path);
    res.status(404).send("Page not found");
  } catch (error) {
    debug("404 handler error: %O", error);
    console.error("404 handler error:", error);
    res.status(500).send("Error processing request");
  }
});

// Initialize client and start server
debug("Starting application...");
initializeClient()
  .then(() => {
    try {
      app.listen(PORT, () => {
        debug(`Server running on http://localhost:${PORT}`);
        console.log(`Server running on http://localhost:${PORT}`);
        console.log("Make sure to configure your AWS Cognito settings before testing");
      });
    } catch (error) {
      debug("Server startup error: %O", error);
      console.error("Server startup error:", error);
    }
  })
  .catch((error) => {
    debug("Initialization error: %O", error);
    console.error("Initialization error:", error);
  });

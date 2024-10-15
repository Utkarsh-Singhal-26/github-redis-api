import express from "express";
import fetch from "node-fetch";
import redis from "redis";

const PORT = process.env.PORT || 5000;
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const client = redis.createClient({
  url: `redis://localhost:${REDIS_PORT}`,
});

(async () => {
  try {
    await client.connect();
    console.log("Connected to Redis");
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    process.exit(1);
  }
})();

const app = express();

// Set response
function setResponse(username, repos) {
  return `<h2>${username} has ${repos} Github repositories</h2>`;
}

// Make request to Github for data
async function getRepos(req, res) {
  try {
    console.log("Fetching Data...");

    const { username } = req.params;
    const response = await fetch(`https://api.github.com/users/${username}`);
    const data = await response.json();

    if (response.status === 404) {
      return res.status(404).send(`<h2>User ${username} not found</h2>`);
    }

    const repos = data.public_repos;

    // Set data to Redis
    await client.setEx(username, 3600, repos.toString());

    res.send(setResponse(username, repos));
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
}

// Cache middleware
async function cache(req, res, next) {
  const { username } = req.params;

  try {
    const data = await client.get(username);

    if (data !== null) {
      console.log("Cache hit");
      res.send(setResponse(username, data));
    } else {
      console.log("Cache miss");
      next();
    }
  } catch (err) {
    console.error("Redis error:", err);
    next();
  }
}

app.get("/repos/:username", cache, getRepos);

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});

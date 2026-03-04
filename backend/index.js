// backend/index.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// ─── Allow React Native / frontend to call this API ───
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// ─── Load GeoJSON ───────────────────────────────────────
const geojson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/campus_network.geojson"), "utf8")
);

// ─── Haversine: real distance in meters between two coords ──
function haversine([lon1, lat1], [lon2, lat2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Build graph from LineString features ──────────────
function buildGraph(geojson) {
  const graph = {}; // { "lon,lat": [{ node: "lon,lat", weight: meters }] }

  const addEdge = (a, b) => {
    const w = haversine(a, b);
    const keyA = a.join(",");
    const keyB = b.join(",");
    if (!graph[keyA]) graph[keyA] = [];
    if (!graph[keyB]) graph[keyB] = [];
    graph[keyA].push({ node: keyB, weight: w });
    graph[keyB].push({ node: keyA, weight: w }); // undirected
  };

  geojson.features.forEach((feature) => {
    if (feature.geometry.type === "LineString") {
      const coords = feature.geometry.coordinates;
      for (let i = 0; i < coords.length - 1; i++) {
        addEdge(coords[i], coords[i + 1]);
      }
    }
  });

  // ─── Auto-snap: connect endpoints within 20 meters ───
  const SNAP_DISTANCE = 20; // meters
  const keys = Object.keys(graph);

  const endpoints = keys.filter(k => graph[k].length === 1);

  endpoints.forEach(epKey => {
    const epCoord = epKey.split(",").map(Number);
    keys.forEach(otherKey => {
      if (otherKey === epKey) return;
      const otherCoord = otherKey.split(",").map(Number);
      const dist = haversine(epCoord, otherCoord);
      if (dist < SNAP_DISTANCE) {
        const alreadyConnected = graph[epKey].some(e => e.node === otherKey);
        if (!alreadyConnected) {
          graph[epKey].push({ node: otherKey, weight: dist });
          graph[otherKey].push({ node: epKey, weight: dist });
          console.log(`🔗 Auto-snapped: ${epKey} ↔ ${otherKey} (${Math.round(dist)}m)`);
        }
      }
    });
  });

  return graph;
}

// ─── Dijkstra ──────────────────────────────────────────
function dijkstra(graph, startKey, endKey) {
  const dist = {};
  const prev = {};
  const visited = new Set();

  Object.keys(graph).forEach((n) => (dist[n] = Infinity));
  dist[startKey] = 0;

  const queue = [{ node: startKey, cost: 0 }];

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const { node } = queue.shift();
    if (visited.has(node)) continue;
    visited.add(node);
    if (node === endKey) break;

    for (const { node: nb, weight } of graph[node] || []) {
      const newDist = dist[node] + weight;
      if (newDist < dist[nb]) {
        dist[nb] = newDist;
        prev[nb] = node;
        queue.push({ node: nb, cost: newDist });
      }
    }
  }

  const path = [];
  let cur = endKey;
  while (cur) {
    path.unshift(cur);
    cur = prev[cur];
  }

  if (path[0] !== startKey) return null; 

  return {
    path: path.map((key) => key.split(",").map(Number)), 
    distanceMeters: Math.round(dist[endKey]),
  };
}

// ─── Find nearest graph node to a given coordinate ─────
function nearestNode(graph, [lon, lat]) {
  let minDist = Infinity;
  let nearest = null;
  for (const key of Object.keys(graph)) {
    const [nLon, nLat] = key.split(",").map(Number);
    const d = haversine([lon, lat], [nLon, nLat]);
    if (d < minDist) {
      minDist = d;
      nearest = key;
    }
  }
  return nearest;
}

// ─── Build once at startup ──────────────────────────────
const graph = buildGraph(geojson);
console.log(`✅ Graph built: ${Object.keys(graph).length} nodes`);

// ─── GET /nodes ─────────────────────────────────────────
app.get("/nodes", (req, res) => {
  const nodes = Object.keys(graph).map((key) => {
    const [lon, lat] = key.split(",").map(Number);
    return { lon, lat };
  });
  res.json({ count: nodes.length, nodes });
});

// ─── GET /paths ─────────────────────────────────────────
app.get("/paths", (req, res) => {
  const paths = [];
  geojson.features.forEach((feature) => {
    if (feature.geometry.type === "LineString") {
      const coords = feature.geometry.coordinates.map(([lon, lat]) => ({
        latitude: lat,
        longitude: lon,
      }));
      paths.push(coords);
    }
  });
  res.json({ paths });
});

// ─── POST /route ────────────────────────────────────────
app.post("/route", (req, res) => {
  const { start, end } = req.body;

  if (
    !Array.isArray(start) || start.length !== 2 ||
    !Array.isArray(end)   || end.length !== 2
  ) {
    return res.status(400).json({ error: "start and end must be [lon, lat] arrays" });
  }

  const startKey = nearestNode(graph, start);
  const endKey   = nearestNode(graph, end);

  if (!startKey || !endKey) {
    return res.status(404).json({ error: "Could not find nearby path nodes" });
  }

  const result = dijkstra(graph, startKey, endKey);

  if (!result) {
    return res.status(404).json({ error: "No route found between these points" });
  }

  // --- Last Mile Stitching & ETA ---
  const startToPathDist = haversine(start, startKey.split(",").map(Number));
  const pathToEndDist = haversine(endKey.split(",").map(Number), end);
  const totalDistance = Math.round(result.distanceMeters + startToPathDist + pathToEndDist);
  
  // Calculate ETA (Average walk speed ~ 1.4 m/s)
  const walkingTimeMinutes = Math.ceil(totalDistance / 1.4 / 60);

  const finalPath = [
    start,              
    ...result.path,     
    end                 
  ];

  res.json({
    start: startKey.split(",").map(Number),
    end:   endKey.split(",").map(Number),
    path:  finalPath,          
    distanceMeters: totalDistance,
    etaMinutes: walkingTimeMinutes // Sent to frontend
  });
});

// ─── Start server ───────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
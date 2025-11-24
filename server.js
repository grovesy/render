const express = require("express");
const path = require("path");
//const cors = require("cors");
const { buildGraphFromSchemas } = require("./schemaGraph");

const app = express();
// app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const schemaDirs =
  process.env.SCHEMA_DIRS?.split(",").map((x) => x.trim()) || ["./examples"];

console.log("Schema dirs:", schemaDirs);

app.get("/graph", async (req, res) => {
  try {
    const graph = await buildGraphFromSchemas(schemaDirs);
    res.json(graph);
  } catch (err) {
    console.error("Error building graph:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Schema UML server running at http://localhost:3000");
});

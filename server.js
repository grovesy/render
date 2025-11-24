const express = require("express");
const cors = require("cors");
const { buildGraphFromSchemas } = require("./schemaGraph");

const app = express();
app.use(cors());
app.use(express.static("public"));

app.get("/graph", (req, res) => {
    try {
        const result = buildGraphFromSchemas([
            "C:/projects/render/examples"
        ]);
        res.json(result);
    } catch (e) {
        console.error("Error building graph:", e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(3000, () => {
    console.log("Schema UML Viewer running on http://localhost:3000");
});

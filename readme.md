# Scan a single directory
python generate.py ./examples -o schema_graph.md

# Scan multiple directories
python generate.py --dirs ./examples ./more_schemas -o schema_graph.md

# Mix files + directories
python generate.py ./one.json ./two.json --dirs ./examples -o README.md

import argparse
import json
import os
import re
import sys
import subprocess
from typing import Dict, Any, List, Tuple, Optional, Iterable


def parse_schema_id(id_str: str) -> Tuple[str, str, str]:
    """Parse IDs like:
       data://<domain1>.<domain2>.<domain3>/model/version/model-name
       Returns: (domain, version, model_name)
    """
    if not id_str.startswith("data://"):
        raise ValueError(f"Unsupported id format: {id_str}")

    without = id_str[len("data://"):]
    domain, rest = without.split("/model/", 1)
    version, model_name = rest.split("/", 1)
    return domain, version, model_name


def normalize_node_id(domain: str, model_name: str) -> str:
    """Convert domain + model name into a Graphviz-safe node ID."""
    node = f"{domain}_{model_name}"
    return re.sub(r"[^A-Za-z0-9_]", "_", node)


def extract_schema_meta(schema: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Extract metadata such as domain, model name, node ID."""
    id_str = schema.get("$id") or schema.get("id")
    if not id_str:
        return None

    domain, version, model_name = parse_schema_id(id_str)
    title = schema.get("title") or model_name
    node_id = normalize_node_id(domain, model_name)

    return {
        "id_str": id_str,
        "domain": domain,
        "version": version,
        "model_name": model_name,
        "node_id": node_id,
        "title": title,
    }


def guess_property_type(prop_schema: Dict[str, Any]) -> str:
    """Best-effort guess of a UML/ER-style type from a JSON Schema property."""
    if "$ref" in prop_schema:
        return "ref"

    t = prop_schema.get("type")
    if isinstance(t, list):
        return "|".join(str(x) for x in t)
    if isinstance(t, str):
        return t
    return "any"


def escape_label(s: str) -> str:
    """Escape a string for use inside a Graphviz label."""
    return s.replace("\\", "\\\\").replace('"', '\\"')


def schemas_to_dot(schemas: List[Dict[str, Any]]) -> str:
    """
    Render a Graphviz DOT digraph:

    - rankdir=TB (top to bottom)
    - subgraph cluster_<domain> per domain (domain box)
    - node per schema, record-shaped, label = Title | attributes
    - $ref properties => edges (src -> tgt [label="prop"])
    - entities with at least one resolvable $ref are styled as red boxes
    """
    meta_by_id: Dict[str, Dict[str, Any]] = {}
    domains: Dict[str, List[Dict[str, Any]]] = {}
    schema_by_id: Dict[str, Dict[str, Any]] = {}

    # Collect metadata and domain grouping
    for s in schemas:
        meta = extract_schema_meta(s)
        if not meta:
            continue
        meta_by_id[meta["id_str"]] = meta
        schema_by_id[meta["id_str"]] = s
        domains.setdefault(meta["domain"], []).append(meta)

    # Build lookup of schemas by (domain/model) for resolving refs
    lookup: Dict[str, Dict[str, Any]] = {
        f'{meta["domain"]}/{meta["model_name"]}': meta
        for meta in meta_by_id.values()
    }

    lines: List[str] = []
    lines.append("digraph SchemaGraph {")
    lines.append('  graph [rankdir=TB, fontsize=10, fontname="Helvetica"];')
    lines.append('  node  [shape=record, fontsize=9, fontname="Helvetica"];')
    lines.append('  edge  [fontsize=8, fontname="Helvetica"];')

    # Keep track of nodes that should be highlighted (have resolvable $ref)
    ref_highlight_nodes: set[str] = set()

    # Emit clusters and nodes
    for domain, metas in sorted(domains.items(), key=lambda kv: kv[0]):
        cluster_id = "cluster_" + re.sub(r"[^A-Za-z0-9_]", "_", domain)
        lines.append(f'  subgraph {cluster_id} {{')
        lines.append('    style=rounded;')
        lines.append('    color="#cccccc";')
        lines.append(f'    label="{escape_label(domain)}";')

        for meta in metas:
            node_id = meta["node_id"]
            title = meta["title"]

            schema = schema_by_id.get(meta["id_str"], {})
            props = schema.get("properties", {})

            has_resolved_ref = False
            attr_lines: List[str] = []

            for prop_name, prop_schema in props.items():
                prop_type = guess_property_type(prop_schema)
                attr_lines.append(f"{prop_name}: {prop_type}")

                # Check if this property has a resolvable $ref
                ref = prop_schema.get("$ref")
                if ref:
                    base_ref = ref.split("#", 1)[0]
                    try:
                        tgt_domain, tgt_ver, tgt_model = parse_schema_id(base_ref)
                        key = f"{tgt_domain}/{tgt_model}"
                        if key in lookup:
                            has_resolved_ref = True
                    except Exception:
                        pass

            # Build record label: {Title|prop1: type\lprop2: type\l}
            if attr_lines:
                attrs_text = "\\l".join(escape_label(a) for a in attr_lines) + "\\l"
            else:
                attrs_text = ""

            label = f'{{{escape_label(title)}|{attrs_text}}}'

            if has_resolved_ref:
                ref_highlight_nodes.add(node_id)
                lines.append(
                    f'    {node_id} [label="{label}", style="filled,bold", fillcolor="#ffcccc", color="#ff0000"];'
                )
            else:
                lines.append(
                    f'    {node_id} [label="{label}"];'
                )

        lines.append("  }")  # end cluster

    # Edges from $ref (foreign keys)
    lines.append("")
    lines.append("  // Relationships (foreign keys via $ref)")
    for schema in schemas:
        src_meta = extract_schema_meta(schema)
        if not src_meta:
            continue

        src_node = src_meta["node_id"]
        props = schema.get("properties", {})

        for prop_name, prop in props.items():
            ref = prop.get("$ref")
            if not ref:
                continue

            base_ref = ref.split("#", 1)[0]

            try:
                tgt_domain, tgt_ver, tgt_model = parse_schema_id(base_ref)
            except Exception:
                continue

            key = f"{tgt_domain}/{tgt_model}"
            tgt_meta = lookup.get(key)
            if not tgt_meta:
                continue

            tgt_node = tgt_meta["node_id"]
            lines.append(
                f'  {src_node} -> {tgt_node} [label="{escape_label(prop_name)}"];'
            )

    lines.append("}")
    return "\n".join(lines)


def _load_from_path(path: str, schemas: List[Dict[str, Any]]):
    """Helper: load schemas from a single path (file or directory)."""
    if os.path.isdir(path):
        for root, _, files in os.walk(path):
            for name in files:
                if not name.lower().endswith(".json"):
                    continue
                full_path = os.path.join(root, name)
                try:
                    with open(full_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        schemas.append(data)
                except Exception as e:
                    print(f"Warning: failed to load {full_path}: {e}", file=sys.stderr)
    elif os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                schemas.append(data)
        except Exception as e:
            print(f"Warning: failed to load {path}: {e}", file=sys.stderr)
    else:
        print(f"Warning: path not found: {path}", file=sys.stderr)


def load_schemas_from_paths(paths: Iterable[str]) -> List[Dict[str, Any]]:
    """Load all JSON schemas from the given file / directory paths."""
    schemas: List[Dict[str, Any]] = []
    for path in paths:
        _load_from_path(path, schemas)
    return schemas


def write_svg(dot_text: str, filename: str = "schema_graph.svg"):
    """Run Graphviz dot -Tsvg on the DOT text and write to filename."""
    try:
        proc = subprocess.run(
            ["dot", "-Tsvg"],
            input=dot_text.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    except FileNotFoundError:
        print("Error: 'dot' (Graphviz) not found on PATH. Please install Graphviz.", file=sys.stderr)
        sys.exit(1)

    if proc.returncode != 0:
        print("Error: dot failed:", file=sys.stderr)
        print(proc.stderr.decode("utf-8", errors="ignore"), file=sys.stderr)
        sys.exit(proc.returncode)

    with open(filename, "wb") as f:
        f.write(proc.stdout)

    print(f"SVG file written: {filename}")


def main(argv: Optional[List[str]] = None):
    parser = argparse.ArgumentParser(
        description="Generate an ER-style Graphviz SVG from JSON Schemas."
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="Optional files and/or folders containing JSON Schema documents.",
    )
    parser.add_argument(
        "--dirs",
        nargs="*",
        default=None,
        help="Additional directories to recursively scan for JSON Schema documents.",
    )
    parser.add_argument(
        "-o",
        "--out",
        default="schema_graph.svg",
        help="Output SVG file (default: schema_graph.svg)",
    )

    args = parser.parse_args(argv)

    all_paths: List[str] = []
    if args.paths:
        all_paths.extend(args.paths)
    if args.dirs:
        all_paths.extend(args.dirs)

    if not all_paths:
        print("No input paths provided (files or --dirs).", file=sys.stderr)
        sys.exit(1)

    schemas = load_schemas_from_paths(all_paths)
    if not schemas:
        print("No schemas loaded from given paths.", file=sys.stderr)
        sys.exit(1)

    dot = schemas_to_dot(schemas)
    write_svg(dot, args.out)


if __name__ == "__main__":
    main()

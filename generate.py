import argparse
import json
import os
import re
import sys
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
    """Convert domain + model name into a Mermaid-safe node ID."""
    node = f"{domain}_{model_name}"
    return re.sub(r"[^A-Za-z0-9_]", "_", node)


def extract_schema_meta(schema: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Extract metadata such as domain, model name, Mermaid ID."""
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


def schemas_to_mermaid(schemas: List[Dict[str, Any]]) -> str:
    """
    Render a Mermaid flowchart in TB orientation, ER-style:

    - flowchart TB (top to bottom)
    - subgraph per domain (domain box)
    - node per schema, label = title + attributes listed (ER entity)
    - $ref properties => edges (A --> B : propName)
    - domain-level anchors + edges to push layout vertical
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
    lines.append("flowchart TB")  # top-to-bottom

    domain_anchors: Dict[str, str] = {}
    ref_highlight_nodes: set[str] = set()

    # Emit subgraphs, domain anchors, and ER-style entity boxes
    for domain, metas in sorted(domains.items(), key=lambda kv: kv[0]):
        group_id = re.sub(r"[^A-Za-z0-9_]", "_", domain)
        anchor_id = f"{group_id}_anchor"
        domain_anchors[domain] = anchor_id

        lines.append("")
        lines.append(f"  subgraph {group_id} [{domain}]")
        lines.append(f'    {anchor_id}["{domain}"]')

        for meta in metas:
            node_id = meta["node_id"]
            title = meta["title"]

            schema = schema_by_id.get(meta["id_str"], {})
            props = schema.get("properties", {})

            # Build ER-style label: name + separator + attributes
            label_lines: List[str] = []
            label_lines.append(title)
            label_lines.append("──────────────")

            has_resolved_ref = False

            for prop_name, prop_schema in props.items():
                prop_type = guess_property_type(prop_schema)

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

                label_lines.append(f"{prop_name}: {prop_type}")

            # Build label with HTML <br/> so multi-line works in many Mermaid renderers
            label = "<br/>".join(label_lines)
            label = label.replace('"', '\\"')  # escape quotes

            lines.append(f'    {node_id}["{label}"]')
            lines.append(f"    {anchor_id} --> {node_id}")

            if has_resolved_ref:
                ref_highlight_nodes.add(node_id)

        lines.append("  end")

    # Chain domain anchors vertically to encourage vertical stacking of domain boxes
    lines.append("")
    lines.append("  %% Layout chain to stack domains vertically")
    ordered_domains = [d for d, _ in sorted(domains.items(), key=lambda kv: kv[0])]
    for i in range(len(ordered_domains) - 1):
        d1 = ordered_domains[i]
        d2 = ordered_domains[i + 1]
        a1 = domain_anchors[d1]
        a2 = domain_anchors[d2]
        lines.append(f"  {a1} --> {a2}")

    # Edges from $ref (foreign keys)
    lines.append("")
    lines.append("  %% Relationships (foreign keys via $ref)")
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
            lines.append(f'  {src_node} -->|{prop_name}| {tgt_node}')

    # Highlight entities that have at least one resolvable $ref
    if ref_highlight_nodes:
        lines.append("")
        lines.append("  %% Highlight entities with resolvable $ref as red boxes")
        lines.append("  classDef refEntity fill=#ffcccc,stroke=#ff0000,stroke-width=1px;")
        for node in sorted(ref_highlight_nodes):
            lines.append(f"  class {node} refEntity")

    return "\n".join(lines)


def write_markdown(mermaid_text: str, filename: str = "schema_graph.md"):
    """Write a markdown file embedding the Mermaid diagram."""
    md: List[str] = []
    md.append("# Schema Relationship Diagram\n")
    md.append("```mermaid")
    md.append(mermaid_text)
    md.append("```")

    with open(filename, "w", encoding="utf-8") as f:
        f.write("\n".join(md))

    print(f"Markdown file written: {filename}")


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


def main(argv: Optional[List[str]] = None):
    parser = argparse.ArgumentParser(
        description="Generate a vertical ER-style Mermaid diagram (in markdown) from JSON Schemas."
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
        default="schema_graph.md",
        help="Output markdown file (default: schema_graph.md)",
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

    mermaid = schemas_to_mermaid(schemas)
    write_markdown(mermaid, args.out)


if __name__ == "__main__":
    main()

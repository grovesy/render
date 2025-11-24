import json
import re
from typing import Dict, Any, List, Tuple, Optional


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
    """Convert domain + model name into a Mermaid-safe ID."""
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


def schemas_to_mermaid(schemas: List[Dict[str, Any]]) -> str:
    """Render Mermaid flowchart with domain-based subgraphs + ref edges."""
    meta_by_id: Dict[str, Dict[str, Any]] = {}
    domains: Dict[str, List[Dict[str, Any]]] = {}

    for s in schemas:
        meta = extract_schema_meta(s)
        if not meta:
            continue
        meta_by_id[meta["id_str"]] = meta
        domains.setdefault(meta["domain"], []).append(meta)

    # Mermaid output lines
    out: List[str] = []
    out.append("flowchart LR")

    # Subgraphs per domain
    for domain, metas in domains.items():
        group_id = re.sub(r"[^A-Za-z0-9_]", "_", domain)
        out.append(f"  subgraph {group_id} [{domain}]")

        for m in metas:
            out.append(f'    {m["node_id"]}["{m["title"]}"]')

        out.append("  end\n")

    # Build lookup of schemas by (domain/model)
    lookup = {
        f'{meta["domain"]}/{meta["model_name"]}': meta
        for meta in meta_by_id.values()
    }

    # Edges from $ref
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
                continue  # skip malformed refs

            key = f"{tgt_domain}/{tgt_model}"
            tgt_meta = lookup.get(key)
            if not tgt_meta:
                continue

            out.append(f'  {src_node} -->|{prop_name}| {tgt_meta["node_id"]}')

    return "\n".join(out)


def write_markdown(mermaid_text: str, filename: str = "schema_graph.md"):
    """Write a markdown file embedding the Mermaid diagram."""
    md = []
    md.append("# Schema Relationship Diagram\n")
    md.append("```mermaid")
    md.append(mermaid_text)
    md.append("```")

    with open(filename, "w", encoding="utf-8") as f:
        f.write("\n".join(md))

    print(f"Markdown file written: {filename}")


# -------------------------
# Example usage
# -------------------------
if __name__ == "__main__":
    # Example schemas (add your generated schemas here)
    account_schema = {
        "id": "data://account.org.biz/model/1/account",
        "title": "Account",
        "type": "object",
        "properties": {
            "routingNumber": {"type": "string"},
            "accountNumber": {"type": "string"},
            "accountName": {"type": "string"},
        }
    }

    contact_schema = {
        "$id": "data://contact.org.biz/model/1/contact",
        "title": "Contact",
        "type": "object",
        "properties": {
            "contactId": {"type": "string"},
            "firstName": {"type": "string"},
            "lastName": {"type": "string"}
        }
    }

    contact_details = {
        "$id": "data://contact.org.biz/model/1/contact-details",
        "title": "ContactDetails",
        "type": "object",
        "properties": {
            "contactId": {
                "$ref": "data://contact.org.biz/model/1/contact#/properties/contactId"
            },
            "email": {"type": "string"},
            "phoneNumber": {"type": "string"}
        }
    }

    all_schemas = [account_schema, contact_schema, contact_details]

    mermaid = schemas_to_mermaid(all_schemas)
    write_markdown(mermaid)
    
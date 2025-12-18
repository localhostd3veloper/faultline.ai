import json
import re
from typing import List

from ..config import settings
from ..schemas.analysis import (
    Component,
    ContentType,
    Endpoint,
    HeuristicFinding,
    NormalizedArtifact,
    Severity,
)


def normalize_artifact(content: str, content_type: ContentType) -> NormalizedArtifact:
    if content_type in [ContentType.OPENAPI_JSON, ContentType.OPENAPI_YAML]:
        return _normalize_openapi(content, content_type)
    elif content_type == ContentType.ARCHITECTURE:
        return _normalize_architecture(content)
    else:
        return _normalize_markdown(content)


def _normalize_openapi(content: str, content_type: ContentType) -> NormalizedArtifact:
    endpoints = []
    # Simplified parsing for demonstration
    if content_type == ContentType.OPENAPI_JSON:
        try:
            data = json.loads(content)
            paths = data.get("paths", {})
            for path, methods in paths.items():
                if len(endpoints) >= settings.MAX_ENDPOINTS:
                    break
                for method, details in methods.items():
                    if len(endpoints) >= settings.MAX_ENDPOINTS:
                        break
                    if method.lower() in ["get", "post", "put", "delete", "patch"]:
                        # Basic check for security, pagination, versioning
                        secured = "security" in details or "security" in data
                        has_pagination = any(
                            p.get("name") in ["page", "offset", "limit"]
                            for p in details.get("parameters", [])
                        )
                        has_versioning = (
                            "/v" in path
                            or "version"
                            in data.get("info", {}).get("version", "").lower()
                        )

                        endpoints.append(
                            Endpoint(
                                path=path,
                                method=method.upper(),
                                secured=secured,
                                has_pagination=has_pagination,
                                has_versioning=has_versioning,
                            )
                        )
        except (json.JSONDecodeError, AttributeError):
            pass
    # For YAML or failed JSON, fallback to regex for simple extraction
    if not endpoints:
        path_matches = re.findall(r"(['\"]?)/([a-zA-Z0-9/_{}-]+)\1:", content)
        for _, path in path_matches[: settings.MAX_ENDPOINTS]:
            endpoints.append(
                Endpoint(
                    path=f"/{path}",
                    method="UNKNOWN",
                    secured=True,  # Default to true for heuristic check
                )
            )

    return NormalizedArtifact(
        kind="openapi", endpoints=endpoints, raw_sections={"content": content}
    )


def _normalize_architecture(content: str) -> NormalizedArtifact:
    services = re.findall(
        r"(?i)(?:service|microservice|app|worker)\s+([a-zA-Z0-9_-]+)", content
    )
    components = []

    # Keyword search for components
    keywords = {
        "database": ["postgres", "mysql", "mongodb", "redis", "db", "database"],
        "queue": ["rabbitmq", "kafka", "sqs", "pubsub", "queue"],
        "cache": ["redis", "memcached", "cache"],
    }

    for kind, words in keywords.items():
        if len(components) >= settings.MAX_COMPONENTS:
            break
        for word in words:
            if len(components) >= settings.MAX_COMPONENTS:
                break
            if re.search(rf"(?i)\b{word}\b", content):
                components.append(Component(name=word, type=kind))

    return NormalizedArtifact(
        kind="architecture",
        services=list(set(services)),
        components=components,
        raw_sections={"content": content},
    )


def _normalize_markdown(content: str) -> NormalizedArtifact:
    sections = {}
    current_section = "General"
    lines = content.split("\n")
    for line in lines:
        if line.startswith("#"):
            if len(sections) >= settings.MAX_SECTIONS:
                break
            current_section = line.strip("# ").strip()
            sections[current_section] = ""
        else:
            sections[current_section] = sections.get(current_section, "") + line + "\n"

    return NormalizedArtifact(kind="markdown", raw_sections=sections)


def run_heuristics(normalized: NormalizedArtifact) -> List[HeuristicFinding]:
    if normalized.kind == "openapi":
        return _openapi_heuristics(normalized)
    if normalized.kind == "architecture":
        return _architecture_heuristics(normalized)
    if normalized.kind == "markdown":
        return _markdown_heuristics(normalized)
    return []


def _openapi_heuristics(normalized: NormalizedArtifact) -> List[HeuristicFinding]:
    findings = []
    if not normalized.endpoints:
        return findings

    for ep in normalized.endpoints:
        if not ep.secured and ep.method != "GET":
            findings.append(
                HeuristicFinding(
                    title=f"Unsecured Write Endpoint: {ep.path}",
                    description=f"The {ep.method} endpoint {ep.path} appears to lack authentication.",
                    category="Security",
                    severity=Severity.HIGH,
                    confidence="high",
                    source="openapi",
                    rationale="Write operations without authentication allow unauthorized data modification.",
                    remediation="Apply security schemes (e.g., Bearer Auth) to this endpoint.",
                )
            )

        if ep.method == "GET" and not ep.has_pagination and "list" in ep.path.lower():
            findings.append(
                HeuristicFinding(
                    title=f"Missing Pagination: {ep.path}",
                    description="List endpoints should support pagination to prevent resource exhaustion.",
                    category="Reliability",
                    severity=Severity.MEDIUM,
                    confidence="high",
                    source="openapi",
                    rationale="Unbounded result sets can crash the server or database under load.",
                    remediation="Add limit/offset or cursor-based pagination parameters.",
                )
            )

    # Check for versioning
    if not any(ep.has_versioning for ep in normalized.endpoints):
        findings.append(
            HeuristicFinding(
                title="Missing API Versioning",
                description="The API does not seem to use versioning in paths or headers.",
                category="Maintainability",
                severity=Severity.MEDIUM,
                confidence="high",
                source="openapi",
                rationale="Breaking changes cannot be introduced safely without versioning.",
                remediation="Introduce /v1/ prefixes or version headers.",
            )
        )

    return findings


def _architecture_heuristics(normalized: NormalizedArtifact) -> List[HeuristicFinding]:
    findings = []
    content = normalized.raw_sections.get("content", "").lower()

    if "auth" not in content and "security" not in content:
        findings.append(
            HeuristicFinding(
                title="Missing Security Architecture",
                description="No mention of authentication or authorization found in the architecture description.",
                category="Security",
                severity=Severity.HIGH,
                confidence="medium",
                source="architecture",
                rationale="Security must be a first-class citizen in architecture planning.",
                remediation="Detail the identity provider and auth flow (e.g., OAuth2, JWT).",
            )
        )

    if (
        "single points of failure" in content
        or "single database" in content
        or len(normalized.services) == 1
        and "database" in [c.type for c in (normalized.components or [])]
    ):
        findings.append(
            HeuristicFinding(
                title="Potential Single Point of Failure",
                description="The architecture suggests a single database or monolithic structure.",
                category="Reliability",
                severity=Severity.MEDIUM,
                confidence="medium",
                source="architecture",
                rationale="A single failure point can take down the entire system.",
                remediation="Implement redundancy and database clustering.",
            )
        )

    return findings


def _markdown_heuristics(normalized: NormalizedArtifact) -> List[HeuristicFinding]:
    findings = []
    required_sections = ["security", "scaling", "deployment", "monitoring"]

    sections_found = [s.lower() for s in normalized.raw_sections.keys()]

    for req in required_sections:
        if not any(req in s for s in sections_found):
            findings.append(
                HeuristicFinding(
                    title=f"Missing Documentation: {req.capitalize()}",
                    description=f"The documentation lacks a dedicated section for {req}.",
                    category="Documentation",
                    severity=Severity.LOW,
                    confidence="low",
                    source="documentation",
                    rationale="Complete documentation is essential for production readiness.",
                    remediation=f"Add a section detailing the {req} strategy.",
                )
            )

    return findings

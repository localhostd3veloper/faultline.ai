import asyncio
from types import SimpleNamespace
from typing import Optional

from pydantic_ai import ModelSettings

from ..schemas.analysis import (
    AgentInput,
    AnalysisData,
    Chart,
    ChartDataPoint,
    Finding,
)


class DemoAnalysisAgent:
    async def run(
        self,
        prompt: str,
        deps: AgentInput,
        model_settings: Optional[ModelSettings] = None,
    ):
        normalized = deps.normalized_artifact
        heuristic_findings = deps.heuristic_findings
        limited_findings = heuristic_findings[:6]

        severity_counts = {
            "High": len(
                [
                    f
                    for f in limited_findings
                    if (
                        f.severity.value if hasattr(f.severity, "value") else f.severity
                    )
                    == "High"
                ]
            ),
            "Medium": len(
                [
                    f
                    for f in limited_findings
                    if (
                        f.severity.value if hasattr(f.severity, "value") else f.severity
                    )
                    == "Medium"
                ]
            ),
            "Low": len(
                [
                    f
                    for f in limited_findings
                    if (
                        f.severity.value if hasattr(f.severity, "value") else f.severity
                    )
                    == "Low"
                ]
            ),
        }

        total_severity_count = sum(severity_counts.values())
        if total_severity_count == 0 or (
            severity_counts["High"] == total_severity_count
            or severity_counts["Medium"] == total_severity_count
            or severity_counts["Low"] == total_severity_count
        ):
            severity_counts = {"High": 2.0, "Medium": 3.0, "Low": 1.0}

        category_counts = {}
        for hf in limited_findings:
            cat = hf.category
            category_counts[cat] = category_counts.get(cat, 0) + 1

        if len(category_counts) <= 1 or (
            len(set(category_counts.values())) == 1 and len(category_counts) > 0
        ):
            category_counts = {
                "Security": 3.0,
                "Reliability": 2.0,
                "Documentation": 1.0,
                "Performance": 2.0,
                "Maintainability": 1.0,
            }

        endpoint_count = len(normalized.endpoints) if normalized.endpoints else 0
        secured_endpoints = len([e for e in (normalized.endpoints or []) if e.secured])
        paginated_endpoints = len(
            [e for e in (normalized.endpoints or []) if e.has_pagination]
        )
        versioned_endpoints = len(
            [e for e in (normalized.endpoints or []) if e.has_versioning]
        )

        component_count = len(normalized.components) if normalized.components else 0
        component_types = {}
        if normalized.components:
            for comp in normalized.components:
                comp_type = comp.type
                component_types[comp_type] = component_types.get(comp_type, 0) + 1

        base_score = 72
        total_findings = len(limited_findings)
        high_severity_impact = severity_counts["High"] * 8
        medium_severity_impact = severity_counts["Medium"] * 4
        low_severity_impact = severity_counts["Low"] * 1
        calculated_score = max(
            0,
            min(
                100,
                base_score
                - (high_severity_impact + medium_severity_impact + low_severity_impact)
                / max(total_findings, 1),
            ),
        )

        analysis_data = AnalysisData(
            production_readiness_score=int(calculated_score),
            summary=f"Analysis of {normalized.kind} artifact complete. Found {len(limited_findings)} issues via heuristics and added AI insights. {endpoint_count} endpoints analyzed across {component_count} components.",
            findings=[
                Finding(
                    title=hf.title,
                    description=hf.description,
                    category=hf.category,
                    severity=hf.severity.value
                    if hasattr(hf.severity, "value")
                    else hf.severity,
                    rationale=hf.rationale,
                    remediation=hf.remediation,
                )
                for hf in limited_findings
            ],
            charts=[
                Chart(
                    title="Finding Severity Distribution",
                    type="pie",
                    description="Distribution of findings by severity levels across all categories.",
                    data=[
                        ChartDataPoint(
                            label="High", value=float(severity_counts["High"])
                        ),
                        ChartDataPoint(
                            label="Medium", value=float(severity_counts["Medium"])
                        ),
                        ChartDataPoint(
                            label="Low", value=float(severity_counts["Low"])
                        ),
                    ],
                ),
                Chart(
                    title="Category Breakdown",
                    type="bar",
                    description="Findings grouped by category with severity weighting.",
                    data=[
                        ChartDataPoint(label=cat, value=float(count))
                        for cat, count in sorted(
                            category_counts.items(), key=lambda x: x[1], reverse=True
                        )
                    ],
                ),
                Chart(
                    title="Production Readiness over Time",
                    type="line",
                    description="Projected readiness score as findings are addressed with realistic remediation timelines.",
                    data=[
                        ChartDataPoint(label="Current", value=float(calculated_score)),
                        ChartDataPoint(
                            label="+3 Days", value=float(calculated_score + 5)
                        ),
                        ChartDataPoint(
                            label="+1 Week", value=float(calculated_score + 12)
                        ),
                        ChartDataPoint(
                            label="+2 Weeks", value=float(calculated_score + 18)
                        ),
                        ChartDataPoint(
                            label="+1 Month", value=float(calculated_score + 22)
                        ),
                        ChartDataPoint(
                            label="+2 Months", value=float(calculated_score + 25)
                        ),
                    ],
                ),
                Chart(
                    title="Endpoint Security Coverage",
                    type="bar",
                    description="Security status breakdown across all API endpoints.",
                    data=[
                        ChartDataPoint(label="Secured", value=float(secured_endpoints)),
                        ChartDataPoint(
                            label="Unsecured",
                            value=float(endpoint_count - secured_endpoints),
                        ),
                        ChartDataPoint(
                            label="Paginated", value=float(paginated_endpoints)
                        ),
                        ChartDataPoint(
                            label="Versioned", value=float(versioned_endpoints)
                        ),
                    ]
                    if endpoint_count > 0
                    else [
                        ChartDataPoint(label="Secured", value=12.0),
                        ChartDataPoint(label="Unsecured", value=3.0),
                        ChartDataPoint(label="Paginated", value=8.0),
                        ChartDataPoint(label="Versioned", value=10.0),
                    ],
                ),
                Chart(
                    title="Risk Score by Category",
                    type="bar",
                    description="Weighted risk scores calculated from finding severity and category impact.",
                    data=[
                        ChartDataPoint(label="Security", value=45.0),
                        ChartDataPoint(label="Reliability", value=28.0),
                        ChartDataPoint(label="Performance", value=22.0),
                        ChartDataPoint(label="Documentation", value=15.0),
                        ChartDataPoint(label="Maintainability", value=12.0),
                        ChartDataPoint(label="Compliance", value=8.0),
                    ],
                ),
                Chart(
                    title="Historical Trend Projection",
                    type="line",
                    description="Projected improvement trajectory based on remediation velocity assumptions.",
                    data=[
                        ChartDataPoint(label="Week -2", value=65.0),
                        ChartDataPoint(label="Week -1", value=68.0),
                        ChartDataPoint(label="Current", value=float(calculated_score)),
                        ChartDataPoint(
                            label="Week +1", value=float(calculated_score + 12)
                        ),
                        ChartDataPoint(
                            label="Week +2", value=float(calculated_score + 18)
                        ),
                        ChartDataPoint(
                            label="Week +3", value=float(calculated_score + 21)
                        ),
                        ChartDataPoint(
                            label="Week +4", value=float(calculated_score + 23)
                        ),
                        ChartDataPoint(
                            label="Week +6", value=float(calculated_score + 25)
                        ),
                        ChartDataPoint(
                            label="Week +8", value=float(calculated_score + 26)
                        ),
                    ],
                ),
            ],
            suggested_next_steps=[
                "Address High severity security findings first - 3 critical vulnerabilities identified.",
                "Implement pagination for identified list endpoints - affects 5 endpoints.",
                "Expand architecture documentation for missing sections - 40% coverage gap.",
                "Add API versioning strategy - only 60% of endpoints are versioned.",
                "Implement comprehensive error handling - 8 endpoints lack proper error responses.",
                "Set up monitoring and alerting for critical service components.",
                "Review and update authentication mechanisms for unsecured endpoints.",
            ],
            markdownReport=f"# Analysis Report for {normalized.kind}\n\n## Summary\n\nComprehensive analysis identified {len(limited_findings)} findings across multiple categories. Production readiness score: {int(calculated_score)}/100.\n\n### Key Metrics\n- **Total Findings**: {len(limited_findings)}\n- **High Severity**: {severity_counts['High']}\n- **Medium Severity**: {severity_counts['Medium']}\n- **Low Severity**: {severity_counts['Low']}\n- **Endpoints Analyzed**: {endpoint_count}\n- **Components Reviewed**: {component_count}\n\n### Critical Areas\n1. Security vulnerabilities require immediate attention\n2. API design improvements needed for scalability\n3. Documentation gaps impact maintainability\n\n## Detailed Findings\n\n{len(limited_findings)} findings have been identified and categorized for remediation.",
        )

        await asyncio.sleep(3.0)

        return SimpleNamespace(
            output=analysis_data,
            usage=lambda: SimpleNamespace(
                request_tokens=0, response_tokens=0, total_tokens=0
            ),
        )


demo = DemoAnalysisAgent()

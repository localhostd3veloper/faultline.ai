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

        analysis_data = AnalysisData(
            production_readiness_score=72,
            summary=f"Analysis of {normalized.kind} artifact complete. Found {len(heuristic_findings)} issues via heuristics and added AI insights.",
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
                for hf in heuristic_findings
            ],
            charts=[
                Chart(
                    title="Finding Severity Distribution",
                    type="pie",
                    description="Distribution of findings by severity levels.",
                    data=[
                        ChartDataPoint(
                            label="High",
                            value=float(
                                len(
                                    [
                                        f
                                        for f in heuristic_findings
                                        if f.severity == "High"
                                    ]
                                )
                            ),
                        ),
                        ChartDataPoint(
                            label="Medium",
                            value=float(
                                len(
                                    [
                                        f
                                        for f in heuristic_findings
                                        if f.severity == "Medium"
                                    ]
                                )
                            ),
                        ),
                        ChartDataPoint(
                            label="Low",
                            value=float(
                                len(
                                    [
                                        f
                                        for f in heuristic_findings
                                        if f.severity == "Low"
                                    ]
                                )
                            ),
                        ),
                    ],
                ),
                Chart(
                    title="Category Breakdown",
                    type="bar",
                    description="Findings grouped by category.",
                    data=[
                        ChartDataPoint(label="Security", value=3.0),
                        ChartDataPoint(label="Reliability", value=2.0),
                        ChartDataPoint(label="Documentation", value=1.0),
                    ],
                ),
                Chart(
                    title="Production Readiness over Time",
                    type="line",
                    description="Projected readiness score as findings are addressed.",
                    data=[
                        ChartDataPoint(label="Current", value=72.0),
                        ChartDataPoint(label="+1 Week", value=85.0),
                        ChartDataPoint(label="+2 Weeks", value=95.0),
                    ],
                ),
            ],
            suggested_next_steps=[
                "Address High severity security findings first.",
                "Implement pagination for identified list endpoints.",
                "Expand architecture documentation for missing sections.",
            ],
            markdown_report=f"# Analysis Report for {normalized.kind}\n\n## Summary\n{len(heuristic_findings)} findings identified.",
        )

        return SimpleNamespace(
            data=analysis_data,
            usage=lambda: SimpleNamespace(
                request_tokens=0, response_tokens=0, total_tokens=0
            ),
        )


demo = DemoAnalysisAgent()

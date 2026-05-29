"""
Email service — weekly anomaly digest via Resend.

Only activates when RESEND_API_KEY is configured.
Graceful failure: logs errors, never crashes the scheduler.
"""

import logging
from datetime import date, timedelta
from html import escape

import requests

from app.config import get_settings
from app.services.cache import get_default_alerts

logger = logging.getLogger(__name__)
settings = get_settings()


def _build_digest_html(alerts_df, dashboard_url: str) -> str:
    """Build HTML email body from recent alerts."""
    week_ago = str(date.today() - timedelta(days=7))
    recent = alerts_df[alerts_df["date"] >= week_ago] if not alerts_df.empty else alerts_df

    total = len(recent)

    # Top 5 by |z-score|
    top_movers = []
    if not recent.empty:
        sorted_alerts = recent.reindex(
            recent["zscore"].abs().sort_values(ascending=False).index
        )
        for _, row in sorted_alerts.head(5).iterrows():
            direction_icon = "🔴" if row["regime"] == "breakdown" else "🔵"
            top_movers.append(
                f"<tr>"
                f"<td style='padding:6px 12px;border-bottom:1px solid #2d2d2d;'>{direction_icon} {escape(str(row['asset1']))}×{escape(str(row['asset2']))}</td>"
                f"<td style='padding:6px 12px;border-bottom:1px solid #2d2d2d;text-align:right;'>{row['zscore']:+.2f}σ</td>"
                f"<td style='padding:6px 12px;border-bottom:1px solid #2d2d2d;'>{escape(str(row['regime']).upper())}</td>"
                f"<td style='padding:6px 12px;border-bottom:1px solid #2d2d2d;'>{escape(str(row['date']))}</td>"
                f"</tr>"
            )

    movers_html = "\n".join(top_movers) if top_movers else "<tr><td colspan='4' style='padding:12px;text-align:center;color:#888;'>No anomalies this week</td></tr>"

    return f"""
    <div style="font-family:'JetBrains Mono',monospace;background:#0a0a0a;color:#e0e0e0;padding:24px;max-width:600px;margin:0 auto;">
        <h1 style="font-size:16px;color:#3b82f6;margin-bottom:4px;">[WEEKLY_ANOMALY_DIGEST]</h1>
        <p style="font-size:11px;color:#888;margin-bottom:20px;">
            Week ending {date.today().isoformat()} · {total} anomalies detected
        </p>

        <h2 style="font-size:12px;color:#f59e0b;margin-bottom:8px;text-transform:uppercase;">Top Movers</h2>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px;">
            <thead>
                <tr style="color:#888;text-transform:uppercase;font-size:10px;">
                    <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #2d2d2d;">Pair</th>
                    <th style="padding:6px 12px;text-align:right;border-bottom:2px solid #2d2d2d;">Z-Score</th>
                    <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #2d2d2d;">Regime</th>
                    <th style="padding:6px 12px;text-align:left;border-bottom:2px solid #2d2d2d;">Date</th>
                </tr>
            </thead>
            <tbody>
                {movers_html}
            </tbody>
        </table>

        <a href="{dashboard_url}?w=60&z=2.0"
           style="display:inline-block;padding:8px 16px;background:#3b82f6;color:#000;font-size:11px;font-weight:bold;text-decoration:none;text-transform:uppercase;letter-spacing:1px;">
            OPEN DASHBOARD →
        </a>

        <p style="font-size:9px;color:#555;margin-top:20px;">
            Cross-Asset Correlations Anomaly Detector v3.0 · Automated weekly digest
        </p>
    </div>
    """


def send_anomaly_digest() -> bool:
    """
    Send weekly anomaly digest to configured recipients via Resend API.
    Returns True on success, False on failure.
    """
    if not settings.RESEND_API_KEY:
        logger.debug("Resend API key not configured, skipping digest.")
        return False

    recipients = settings.alert_recipients_list
    if not recipients:
        logger.debug("No alert recipients configured, skipping digest.")
        return False

    alerts_df = get_default_alerts()
    if alerts_df is None:
        logger.warning("Cache not warm, cannot send digest.")
        return False

    try:
        html_body = _build_digest_html(alerts_df, settings.DASHBOARD_URL)

        payload = {
            "from": "Anomaly Detector <alerts@resend.dev>",
            "to": recipients,
            "subject": f"[ANOMALY_DIGEST] Week of {date.today().isoformat()}",
            "html": html_body,
        }

        resp = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )

        if resp.status_code in (200, 201):
            logger.info(f"Anomaly digest sent to {len(recipients)} recipient(s).")
            return True
        else:
            logger.error(f"Resend API error {resp.status_code}: {resp.text}")
            return False

    except Exception as e:
        logger.error(f"Failed to send anomaly digest: {e}")
        return False

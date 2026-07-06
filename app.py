from __future__ import annotations

import os
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st
from dotenv import load_dotenv

from wealth_dashboard.gmail_client import GmailAttachment, download_pdf_attachments_from_sender
from wealth_dashboard.models import NpsStatement
from wealth_dashboard.nps_parser import parse_nps_statement_text
from wealth_dashboard.pdf_reader import PdfPasswordError, extract_pdf_text

load_dotenv()


def main() -> None:
    st.set_page_config(page_title="Personal Wealth Dashboard", page_icon="$", layout="wide")
    st.title("Personal Wealth Dashboard")
    st.caption("First version: ingest an NPS Tier 1 statement PDF and visualize the current corpus.")

    settings = _sidebar_settings()

    upload_tab, gmail_tab = st.tabs(["Upload NPS statement", "Fetch from Gmail"])

    with upload_tab:
        _render_upload_flow(settings["pdf_password"])

    with gmail_tab:
        _render_gmail_flow(settings)


def _sidebar_settings() -> dict[str, str | int]:
    with st.sidebar:
        st.header("Settings")
        pdf_password = st.text_input(
            "NPS PDF password",
            value=os.getenv("NPS_PDF_PASSWORD", ""),
            type="password",
            help="Used in memory only to decrypt the statement PDF.",
        )
        sender_email = st.text_input(
            "Statement sender email",
            value=os.getenv("GMAIL_SENDER_EMAIL", ""),
            placeholder="statements@example.com",
            help="Gmail search will use from:<this address> has:attachment filename:pdf.",
        )
        extra_query = st.text_input(
            "Optional Gmail search terms",
            value=os.getenv("GMAIL_EXTRA_QUERY", ""),
            placeholder='subject:"NPS" newer_than:90d',
        )
        max_messages = st.number_input("Messages to scan", min_value=1, max_value=50, value=10)
        credentials_path = st.text_input(
            "OAuth credentials path",
            value=os.getenv("GMAIL_CREDENTIALS_PATH", "credentials.json"),
        )
        token_path = st.text_input("OAuth token path", value=os.getenv("GMAIL_TOKEN_PATH", "token.json"))
        output_dir = st.text_input(
            "Attachment download directory",
            value=os.getenv("GMAIL_ATTACHMENT_DIR", "data/gmail_attachments"),
        )

    return {
        "pdf_password": pdf_password,
        "sender_email": sender_email,
        "extra_query": extra_query,
        "max_messages": int(max_messages),
        "credentials_path": credentials_path,
        "token_path": token_path,
        "output_dir": output_dir,
    }


def _render_upload_flow(pdf_password: str) -> None:
    uploaded_file = st.file_uploader("Upload your password-protected NPS Tier 1 statement", type=["pdf"])
    if uploaded_file is None:
        st.info("Upload a statement PDF to parse it without connecting Gmail.")
        return

    if not pdf_password:
        st.warning("Enter the PDF password in the sidebar before parsing the uploaded statement.")
        return

    try:
        text = extract_pdf_text(uploaded_file.getvalue(), password=pdf_password)
        statement = parse_nps_statement_text(text, source_file=Path(uploaded_file.name))
    except (PdfPasswordError, ValueError) as exc:
        st.error(str(exc))
        return

    _render_statement_dashboard(statement)


def _render_gmail_flow(settings: dict[str, str | int]) -> None:
    st.write("Download PDF attachments from a specific sender, then parse the selected NPS statement.")

    if "gmail_attachments" not in st.session_state:
        st.session_state.gmail_attachments = []

    fetch_disabled = not settings["sender_email"]
    if st.button("Fetch PDF attachments from Gmail", disabled=fetch_disabled):
        try:
            attachments = download_pdf_attachments_from_sender(
                str(settings["sender_email"]),
                output_dir=str(settings["output_dir"]),
                credentials_path=str(settings["credentials_path"]),
                token_path=str(settings["token_path"]),
                max_messages=int(settings["max_messages"]),
                extra_query=str(settings["extra_query"]),
            )
        except Exception as exc:  # Google client exceptions include several runtime-specific types.
            st.error(f"Unable to fetch Gmail attachments: {exc}")
        else:
            st.session_state.gmail_attachments = attachments
            st.success(f"Downloaded {len(attachments)} PDF attachment(s).")

    attachments: list[GmailAttachment] = st.session_state.gmail_attachments
    if not attachments:
        st.info("Enter a sender email, fetch attachments, and select a downloaded NPS statement.")
        return

    options = {str(attachment.saved_path): attachment for attachment in attachments}
    selected_path = st.selectbox("Downloaded statement", options=list(options.keys()))
    selected_attachment = options[selected_path]

    st.caption(
        f"Message: {selected_attachment.message_id}"
        + (f" | Date: {selected_attachment.message_date:%Y-%m-%d}" if selected_attachment.message_date else "")
    )

    if not settings["pdf_password"]:
        st.warning("Enter the PDF password in the sidebar before parsing the downloaded statement.")
        return

    if st.button("Parse selected statement"):
        try:
            text = extract_pdf_text(selected_attachment.saved_path, password=str(settings["pdf_password"]))
            statement = parse_nps_statement_text(text, source_file=selected_attachment.saved_path)
        except (PdfPasswordError, ValueError) as exc:
            st.error(str(exc))
            return

        _render_statement_dashboard(statement)


def _render_statement_dashboard(statement: NpsStatement) -> None:
    st.subheader("NPS Tier 1 summary")

    total = statement.dashboard_total
    metric_columns = st.columns(4)
    metric_columns[0].metric("Total NPS wealth", _format_currency(total))
    metric_columns[1].metric("Holdings parsed", str(len(statement.holdings)))
    metric_columns[2].metric("Statement date", statement.as_of_date.isoformat() if statement.as_of_date else "Unknown")
    metric_columns[3].metric("PRAN", _mask_pran(statement.pran) if statement.pran else "Unknown")

    if statement.subscriber_name:
        st.write(f"Subscriber: **{statement.subscriber_name}**")
    if statement.source_file:
        st.caption(f"Source: {statement.source_file}")

    holdings_frame = _holdings_frame(statement)
    if holdings_frame.empty:
        st.warning(
            "The statement total was found, but no holdings rows were parsed. "
            "The parser may need adjustment for this statement layout."
        )
        return

    st.dataframe(holdings_frame, use_container_width=True, hide_index=True)

    chart_columns = st.columns(2)
    with chart_columns[0]:
        st.plotly_chart(
            px.pie(
                holdings_frame,
                names="Scheme",
                values="Market Value",
                title="Allocation by scheme",
                hole=0.35,
            ),
            use_container_width=True,
        )
    with chart_columns[1]:
        group_column = "Asset Class" if holdings_frame["Asset Class"].notna().any() else "Scheme"
        grouped = holdings_frame.groupby(group_column, dropna=False, as_index=False)["Market Value"].sum()
        st.plotly_chart(
            px.bar(
                grouped,
                x=group_column,
                y="Market Value",
                title=f"Market value by {group_column.lower()}",
                text_auto=".2s",
            ),
            use_container_width=True,
        )


def _holdings_frame(statement: NpsStatement) -> pd.DataFrame:
    rows = [
        {
            "Scheme": holding.scheme_name,
            "Asset Class": holding.asset_class,
            "Units": holding.units,
            "NAV": holding.nav,
            "Market Value": holding.market_value,
            "Allocation %": (holding.market_value / statement.dashboard_total * 100)
            if statement.dashboard_total
            else 0,
        }
        for holding in statement.holdings
    ]
    frame = pd.DataFrame(rows)
    if not frame.empty:
        frame = frame.sort_values("Market Value", ascending=False)
    return frame


def _format_currency(value: float) -> str:
    return f"INR {value:,.2f}"


def _mask_pran(pran: str) -> str:
    if len(pran) <= 4:
        return "****"
    return f"{'*' * (len(pran) - 4)}{pran[-4:]}"


if __name__ == "__main__":
    main()


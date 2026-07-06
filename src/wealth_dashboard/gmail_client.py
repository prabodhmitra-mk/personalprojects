from __future__ import annotations

import base64
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"


@dataclass(frozen=True)
class GmailAttachment:
    message_id: str
    filename: str
    saved_path: Path
    sender_query: str
    message_date: datetime | None = None


def get_gmail_service(
    credentials_path: Path | str = "credentials.json",
    token_path: Path | str = "token.json",
) -> Any:
    """Build an authenticated Gmail API service using OAuth user credentials."""

    credentials_path = Path(credentials_path)
    token_path = Path(token_path)
    creds: Credentials | None = None

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), [GMAIL_READONLY_SCOPE])

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not credentials_path.exists():
                raise FileNotFoundError(
                    f"Missing Gmail OAuth client file at {credentials_path}. "
                    "Create a Google Cloud OAuth desktop client and download it as credentials.json."
                )
            flow = InstalledAppFlow.from_client_secrets_file(str(credentials_path), [GMAIL_READONLY_SCOPE])
            creds = flow.run_local_server(port=0)

        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(creds.to_json(), encoding="utf-8")

    return build("gmail", "v1", credentials=creds)


def download_pdf_attachments_from_sender(
    sender_email: str,
    output_dir: Path | str = "data/gmail_attachments",
    *,
    credentials_path: Path | str = "credentials.json",
    token_path: Path | str = "token.json",
    max_messages: int = 10,
    extra_query: str = "",
) -> list[GmailAttachment]:
    """Download PDF attachments from Gmail messages sent by a particular sender."""

    service = get_gmail_service(credentials_path=credentials_path, token_path=token_path)
    return download_pdf_attachments(
        service,
        sender_email=sender_email,
        output_dir=output_dir,
        max_messages=max_messages,
        extra_query=extra_query,
    )


def download_pdf_attachments(
    service: Any,
    *,
    sender_email: str,
    output_dir: Path | str,
    max_messages: int = 10,
    extra_query: str = "",
) -> list[GmailAttachment]:
    query = _build_query(sender_email, extra_query)
    response = (
        service.users()
        .messages()
        .list(userId="me", q=query, maxResults=max_messages)
        .execute()
    )
    messages = response.get("messages", [])
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    attachments: list[GmailAttachment] = []
    for message_ref in messages:
        message = (
            service.users()
            .messages()
            .get(userId="me", id=message_ref["id"], format="full")
            .execute()
        )
        message_date = _message_date(message)

        for part in _walk_parts(message.get("payload", {})):
            filename = part.get("filename", "")
            body = part.get("body", {})
            attachment_id = body.get("attachmentId")
            if not filename.lower().endswith(".pdf") or not attachment_id:
                continue

            attachment = (
                service.users()
                .messages()
                .attachments()
                .get(userId="me", messageId=message_ref["id"], id=attachment_id)
                .execute()
            )
            data = base64.urlsafe_b64decode(attachment["data"].encode("utf-8"))
            saved_path = output_path / _attachment_filename(message_ref["id"], filename, message_date)
            saved_path.write_bytes(data)
            attachments.append(
                GmailAttachment(
                    message_id=message_ref["id"],
                    filename=filename,
                    saved_path=saved_path,
                    sender_query=sender_email,
                    message_date=message_date,
                )
            )

    return attachments


def _build_query(sender_email: str, extra_query: str = "") -> str:
    query_parts = [f"from:{sender_email}", "has:attachment", "filename:pdf"]
    if extra_query.strip():
        query_parts.append(extra_query.strip())
    return " ".join(query_parts)


def _walk_parts(part: dict[str, Any]) -> Iterable[dict[str, Any]]:
    yield part
    for child in part.get("parts", []) or []:
        yield from _walk_parts(child)


def _message_date(message: dict[str, Any]) -> datetime | None:
    internal_date = message.get("internalDate")
    if internal_date is None:
        return None
    try:
        return datetime.fromtimestamp(int(internal_date) / 1000, tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def _attachment_filename(message_id: str, original_filename: str, message_date: datetime | None) -> str:
    date_prefix = message_date.strftime("%Y%m%d") if message_date else "undated"
    safe_message_id = _safe_filename(message_id)[:24]
    safe_original = _safe_filename(original_filename)
    return f"{date_prefix}-{safe_message_id}-{safe_original}"


def _safe_filename(filename: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", filename).strip(".-")
    return cleaned or "attachment.pdf"


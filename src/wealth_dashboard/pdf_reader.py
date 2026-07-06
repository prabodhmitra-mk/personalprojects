from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import BinaryIO

from pypdf import PdfReader
from pypdf.errors import FileNotDecryptedError, PdfReadError


class PdfPasswordError(ValueError):
    """Raised when a PDF cannot be opened with the provided password."""


def extract_pdf_text(
    source: Path | str | bytes | BinaryIO,
    password: str | None = None,
) -> str:
    """Extract text from a plain or password-protected PDF."""

    stream_or_path = _coerce_source(source)

    try:
        reader = PdfReader(stream_or_path)
        if reader.is_encrypted:
            if not password:
                raise PdfPasswordError("This PDF is password protected. Provide the statement password.")
            decrypt_result = reader.decrypt(password)
            if decrypt_result == 0:
                raise PdfPasswordError("Unable to decrypt PDF with the provided password.")

        page_text = [page.extract_text() or "" for page in reader.pages]
    except FileNotDecryptedError as exc:
        raise PdfPasswordError("Unable to decrypt PDF with the provided password.") from exc
    except PdfReadError as exc:
        raise ValueError(f"Unable to read PDF: {exc}") from exc

    text = "\n".join(page_text).strip()
    if not text:
        raise ValueError("PDF text extraction returned no text. This statement may be image-scanned.")
    return text


def _coerce_source(source: Path | str | bytes | BinaryIO) -> Path | BytesIO | BinaryIO:
    if isinstance(source, bytes):
        return BytesIO(source)
    if isinstance(source, str):
        return Path(source)
    return source


from datetime import date

from wealth_dashboard.nps_parser import parse_nps_statement_text


def test_parse_nps_statement_summary_and_holdings() -> None:
    statement = parse_nps_statement_text(
        """
        Subscriber Name: Jane Doe
        PRAN: 123456789012
        Statement Date: 31-Mar-2026

        Scheme Name Units NAV Value
        SBI Pension Fund Scheme E - Tier I 100.0000 50.5000 5,050.00
        HDFC Pension Fund Scheme C - Tier I 200.0000 25.0000 5,000.00
        Contribution 01-Apr-2025 100.0000 10.0000 999.00

        Total Corpus: Rs. 10,050.00
        """
    )

    assert statement.subscriber_name == "Jane Doe"
    assert statement.pran == "123456789012"
    assert statement.as_of_date == date(2026, 3, 31)
    assert statement.total_value == 10050.00
    assert statement.dashboard_total == 10050.00
    assert len(statement.holdings) == 2
    assert statement.holdings[0].scheme_name == "SBI Pension Fund Scheme E - Tier I"
    assert statement.holdings[0].asset_class == "E-TIERI"


def test_parse_nps_statement_uses_holdings_sum_when_total_missing() -> None:
    statement = parse_nps_statement_text(
        """
        As on: 2026-03-31
        LIC Pension Fund Scheme G Tier I 10.0000 20.0000 200.00
        UTI Pension Fund Scheme C Tier I 5.0000 30.0000 150.00
        """
    )

    assert statement.as_of_date == date(2026, 3, 31)
    assert statement.total_value == 350.00
    assert statement.dashboard_total == 350.00
    assert [holding.asset_class for holding in statement.holdings] == ["G", "C"]


def test_parse_nps_statement_ignores_rows_that_do_not_reconcile() -> None:
    statement = parse_nps_statement_text(
        """
        Statement Date: 31/03/2026
        SBI Pension Fund Scheme E Tier I 100.0000 50.0000 5,000.00
        SBI Pension Fund Scheme E Tier I 100.0000 50.0000 9,999.00
        """
    )

    assert len(statement.holdings) == 1
    assert statement.dashboard_total == 5000.00


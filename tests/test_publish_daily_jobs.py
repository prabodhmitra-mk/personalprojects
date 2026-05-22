import unittest

from scripts.publish_daily_jobs import (
    is_remote_india_compatible,
    make_job,
    matching_categories,
)


class JobFilterTests(unittest.TestCase):
    def test_worldwide_remote_finance_role_matches(self):
        job = make_job(
            title="Credit Risk Analyst",
            company="Example Bank",
            location="Remote - Worldwide",
            url="https://example.com/job",
            source="Example",
            published_at="2026-05-20T00:00:00+00:00",
            description="Work from home role for credit underwriting and risk analysis.",
        )

        self.assertIsNotNone(job)
        self.assertIn("Credit underwriting", job.categories)
        self.assertIn("Risk analysis", job.categories)

    def test_us_only_role_is_excluded(self):
        self.assertFalse(
            is_remote_india_compatible(
                "Remote - United States only",
                "Finance analyst role. Remote from the United States only.",
            )
        )

    def test_india_remote_role_is_included(self):
        self.assertTrue(
            is_remote_india_compatible(
                "India",
                "Remote tax analyst role supporting GST and return filing.",
            )
        )

    def test_return_to_work_keywords_match(self):
        categories = matching_categories(
            "Returnship for mothers returning after a career break in accounting."
        )

        self.assertIn("Return-to-work", categories)
        self.assertIn("Accounts", categories)


if __name__ == "__main__":
    unittest.main()

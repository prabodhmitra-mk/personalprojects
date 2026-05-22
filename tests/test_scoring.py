import unittest

from job_sponsor_agent.models import JobPosting
from job_sponsor_agent.profile import CandidateProfile
from job_sponsor_agent.scoring import curate_jobs, score_posting


class ScoringTest(unittest.TestCase):
    def test_keeps_sponsored_role_matching_profile(self):
        profile = CandidateProfile(
            target_titles=("backend engineer",),
            skills=("python", "postgresql"),
            minimum_score=1,
        )
        posting = JobPosting(
            source="Example",
            title="Senior Backend Engineer",
            company="Acme",
            url="https://example.com/jobs/1",
            location="Berlin, Germany",
            description="Python and PostgreSQL role with visa sponsorship and relocation support.",
        )

        scored = score_posting(profile, posting)

        self.assertIsNotNone(scored)
        assert scored is not None
        self.assertTrue(scored.sponsorship_signal)
        self.assertGreaterEqual(scored.score, 70)

    def test_keeps_global_remote_role_available_from_india(self):
        profile = CandidateProfile(
            target_titles=("full stack engineer",),
            skills=("react", "node.js"),
            minimum_score=1,
        )
        posting = JobPosting(
            source="Example",
            title="Full Stack Engineer",
            company="Remote Co",
            url="https://example.com/jobs/2",
            location="Remote - Worldwide / India",
            description="Build with React and Node.js.",
        )

        scored = score_posting(profile, posting)

        self.assertIsNotNone(scored)
        assert scored is not None
        self.assertTrue(scored.location_signal)
        self.assertFalse(scored.sponsorship_signal)

    def test_excludes_roles_that_cannot_sponsor(self):
        profile = CandidateProfile(
            target_titles=("software engineer",),
            skills=("python",),
            minimum_score=1,
        )
        posting = JobPosting(
            source="Example",
            title="Software Engineer",
            company="No Sponsor Inc",
            url="https://example.com/jobs/3",
            location="New York, NY",
            description="Python role. No visa sponsorship is available.",
        )

        self.assertIsNone(score_posting(profile, posting))

    def test_curate_jobs_sorts_by_score_and_limits_results(self):
        profile = CandidateProfile(
            target_titles=("software engineer",),
            skills=("python", "django"),
            max_results=1,
            minimum_score=1,
        )
        postings = [
            JobPosting(
                source="Example",
                title="Software Engineer",
                company="Lower",
                url="https://example.com/jobs/4",
                location="Remote - Worldwide",
                description="Python role.",
            ),
            JobPosting(
                source="Example",
                title="Software Engineer",
                company="Higher",
                url="https://example.com/jobs/5",
                location="Remote - Worldwide",
                description="Python and Django role with visa sponsorship.",
            ),
        ]

        matches = curate_jobs(profile, postings)

        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].posting.company, "Higher")


if __name__ == "__main__":
    unittest.main()

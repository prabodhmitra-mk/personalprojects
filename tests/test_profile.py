import json
import tempfile
import unittest
from pathlib import Path

from job_sponsor_agent.profile import CandidateProfile, load_profile


class ProfileTest(unittest.TestCase):
    def test_profile_search_terms_deduplicate_and_fallback(self):
        profile = CandidateProfile(
            target_titles=("Backend Engineer", "backend engineer"),
            skills=("Python",),
        )

        self.assertEqual(profile.search_terms, ("Backend Engineer", "Python"))

    def test_load_profile_from_json_path(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "profile.json"
            path.write_text(
                json.dumps(
                    {
                        "name": "Test Candidate",
                        "target_titles": ["data engineer"],
                        "skills": ["python", "spark"],
                    }
                ),
                encoding="utf-8",
            )

            loaded = load_profile(path)

        self.assertFalse(loaded.is_example)
        self.assertEqual(loaded.profile.name, "Test Candidate")
        self.assertEqual(loaded.profile.search_terms, ("data engineer", "python", "spark"))


if __name__ == "__main__":
    unittest.main()

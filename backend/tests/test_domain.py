import unittest
from datetime import date
from app.domain import display_status, freshness_status, is_eligible


class DisplayStatusTests(unittest.TestCase):
    def test_elapsed_dates_do_not_claim_completed(self):
        event = {"start_date": "2026-11-02", "end_date": "2026-11-09", "event_status": "unknown"}
        self.assertEqual(display_status(event, date(2026, 11, 19)), "date_elapsed_status_unconfirmed")

    def test_explicit_cancellation_wins_over_dates(self):
        event = {"start_date": "2026-11-02", "end_date": "2026-11-09", "event_status": "cancelled"}
        self.assertEqual(display_status(event, date(2026, 11, 19)), "cancelled")

    def test_future_scheduled_event(self):
        event = {"start_date": "2027-06-01", "end_date": "2027-06-02", "event_status": "scheduled"}
        self.assertEqual(display_status(event, date(2026, 11, 19)), "scheduled")

    def test_malformed_date_is_unconfirmed(self):
        event = {"start_date": "not-a-date", "end_date": "2027-06-02", "event_status": "unknown"}
        self.assertEqual(display_status(event, date(2026, 11, 19)), "date_unverified")

    def test_freshness_ages_faster_near_start(self):
        event = {"start_date": "2026-11-20", "end_date": "2026-11-21", "last_checked_at": "2026-11-15"}
        self.assertEqual(freshness_status(event, date(2026, 11, 19)), "stale")

    def test_missing_check_is_not_fresh(self):
        event = {"start_date": "2027-06-01", "end_date": "2027-06-02", "last_checked_at": None}
        self.assertEqual(freshness_status(event, date(2026, 11, 19)), "never_checked")


class EligibilityTests(unittest.TestCase):
    def test_unknown_restriction_does_not_hide_event(self):
        self.assertTrue(is_eligible({"age_group": None, "hcp_min": None, "hcp_max": None}, 20, "adult"))

    def test_handicap_range(self):
        event = {"hcp_min": 10, "hcp_max": 30}
        self.assertTrue(is_eligible(event, 20))
        self.assertFalse(is_eligible(event, 35))

    def test_age_restriction(self):
        self.assertFalse(is_eligible({"age_group": "juniors"}, age_group="adult"))
        self.assertTrue(is_eligible({"age_group": "open"}, age_group="adult"))


if __name__ == "__main__":
    unittest.main()
